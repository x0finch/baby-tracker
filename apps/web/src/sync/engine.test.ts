import {
  type Baby,
  type Event,
  type PullResponse,
  type PushItemResult,
  type PushRequest,
  type PushResponse,
  newId,
} from '@bobo/shared'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { type LocalStore, openLocalStore } from '../db/local-store'
import { createBaby, updateBaby } from '../features/babies/actions'
import { addEvent, saveEvent } from '../features/events/actions'
import { logDiaper } from '../features/events/records'
import { type SyncApi, syncOnce } from './engine'
import { markDirty, setAccount } from './local'

const FAMILY = newId()

/** In-memory server with the same semantics as the real API: LWW, seq-ordered pulls. */
function createFakeServer(pageSize = 1000) {
  let seq = 0
  const rows = {
    babies: new Map<string, { seq: number; record: Baby }>(),
    events: new Map<string, { seq: number; record: Event }>(),
  }
  const rejectIds = new Set<string>()

  function write<T extends Baby | Event>(
    map: Map<string, { seq: number; record: T }>,
    items: T[],
  ): PushItemResult[] {
    return items.map((item) => {
      if (rejectIds.has(item.id)) return { id: item.id, status: 'rejected', reason: 'forbidden' }
      const current = map.get(item.id)
      if (current && current.record.updatedAt > item.updatedAt)
        return { id: item.id, status: 'stale' }
      map.set(item.id, { seq, record: structuredClone(item) })
      return { id: item.id, status: 'accepted' }
    })
  }

  const api: SyncApi = {
    async push(request: PushRequest): Promise<PushResponse> {
      seq += 1
      return {
        babies: write(rows.babies, request.babies),
        events: write(rows.events, request.events),
      }
    },
    async pull(cursor: string): Promise<PullResponse> {
      const after = Number(cursor || 0)
      const page = <T>(map: Map<string, { seq: number; record: T }>) =>
        [...map.values()].filter((row) => row.seq > after).toSorted((a, b) => a.seq - b.seq)
      const babies = page(rows.babies)
      const events = page(rows.events)
      // Page by seq for simplicity: return whole seq groups up to pageSize records.
      const seqs = [...new Set([...babies, ...events].map((row) => row.seq))].toSorted(
        (a, b) => a - b,
      )
      let count = 0
      let last = after
      for (const s of seqs) {
        const n = [...babies, ...events].filter((row) => row.seq === s).length
        if (count > 0 && count + n > pageSize) break
        count += n
        last = s
      }
      return {
        babies: babies.filter((row) => row.seq <= last).map((row) => structuredClone(row.record)),
        events: events.filter((row) => row.seq <= last).map((row) => structuredClone(row.record)),
        cursor: String(last),
        hasMore: seqs.some((s) => s > last),
      }
    },
  }
  return { api, rows, rejectIds, pushes: () => seq }
}

async function device(): Promise<LocalStore> {
  const store = await openLocalStore({
    idbFactory: new IDBFactory(),
    requestPersistence: async () => true,
  })
  await Promise.all([
    store.babies.preload(),
    store.events.preload(),
    store.outbox.preload(),
    store.meta.preload(),
  ])
  setAccount(store, { userId: 'user-1', familyId: FAMILY })
  return store
}

const input = {
  name: '小宝',
  birthDate: '2026-09-30',
  sex: 'unspecified',
  avatarColor: 'green',
} as const

describe('syncOnce', () => {
  it('moves records from one device to another and empties the outbox', async () => {
    const server = createFakeServer()
    const a = await device()
    const b = await device()
    const baby = createBaby(a, input)
    addEvent(a, logDiaper(baby.id, Date.now(), 'wet'))
    expect(a.outbox.size).toBe(2)

    expect(await syncOnce(a, server.api)).toMatchObject({ pushed: 2 })
    expect(a.outbox.size).toBe(0)

    await syncOnce(b, server.api)
    expect(b.babies.get(baby.id)?.familyId).toBe(FAMILY)
    expect(b.events.toArray).toHaveLength(1)
    expect(b.outbox.size).toBe(0)
  })

  it('converges on the newest version after concurrent edits', async () => {
    const server = createFakeServer()
    const a = await device()
    const b = await device()
    const baby = createBaby(a, input)
    await syncOnce(a, server.api)
    await syncOnce(b, server.api)

    // A edits first, B later; B's version must win on both devices.
    const edit = (store: LocalStore, name: string, updatedAt: number) => {
      store.babies.update(baby.id, (d) => Object.assign(d, { name, updatedAt }))
      markDirty(store, 'babies', { ...baby, name, updatedAt })
    }
    edit(a, 'A 改的', baby.updatedAt + 10)
    edit(b, 'B 改的', baby.updatedAt + 20)

    await syncOnce(b, server.api)
    await syncOnce(a, server.api) // A's push is stale; the pull brings B's version
    expect(a.babies.get(baby.id)?.name).toBe('B 改的')
    expect(b.babies.get(baby.id)?.name).toBe('B 改的')
    expect(a.outbox.size).toBe(0)
  })

  it('keeps a newer pending local change over an older remote version', async () => {
    const a = await device()
    const baby = createBaby(a, input)
    updateBaby(a, baby.id, { ...input, name: '本地更新' })
    const offlinePush: SyncApi = {
      // The push fails to reach the server, but a pull with an older copy succeeds.
      push: async () => ({ babies: [], events: [] }),
      pull: async () => ({
        babies: [{ ...baby, name: '旧的远端' }],
        events: [],
        cursor: '1',
        hasMore: false,
      }),
    }
    await syncOnce(a, offlinePush)
    expect(a.babies.get(baby.id)?.name).toBe('本地更新')
    expect(a.outbox.size).toBe(1)
  })

  it('keeps changes made while a push is in flight', async () => {
    const server = createFakeServer()
    const a = await device()
    const baby = createBaby(a, input)
    const event = logDiaper(baby.id, Date.now(), 'wet')
    addEvent(a, event)
    const api: SyncApi = {
      ...server.api,
      async push(request) {
        const response = await server.api.push(request)
        // The user edits the event before the push is acknowledged.
        saveEvent(a, { ...a.events.get(event.id)!, note: '后来补充', updatedAt: Date.now() + 1000 })
        return response
      },
    }
    await syncOnce(a, api)
    expect(a.outbox.has(`events:${event.id}`)).toBe(true)
    await syncOnce(a, server.api)
    expect(server.rows.events.get(event.id)?.record.note).toBe('后来补充')
  })

  it('holds back records without a family without blocking the rest', async () => {
    const server = createFakeServer()
    const a = await device()
    setAccount(a, undefined)
    const unclaimed = createBaby(a, input) // familyId null while signed out
    setAccount(a, { userId: 'user-1', familyId: FAMILY })
    const claimed = createBaby(a, { ...input, name: '有家庭' })
    await syncOnce(a, server.api)
    expect(server.rows.babies.has(claimed.id)).toBe(true)
    expect(server.rows.babies.has(unclaimed.id)).toBe(false)
    expect(a.outbox.has(`babies:${unclaimed.id}`)).toBe(true)
  })

  it('reports and clears rejected changes', async () => {
    const server = createFakeServer()
    const a = await device()
    const baby = createBaby(a, input)
    server.rejectIds.add(baby.id)
    const result = await syncOnce(a, server.api)
    expect(result.rejected).toEqual([{ table: 'babies', id: baby.id, reason: 'forbidden' }])
    expect(a.outbox.size).toBe(0)
  })

  it('pushes large backlogs in batches and pages through pulls', async () => {
    const server = createFakeServer(200)
    const a = await device()
    const b = await device()
    const baby = createBaby(a, input)
    for (let i = 0; i < 620; i += 1) addEvent(a, logDiaper(baby.id, Date.now() - i * 1000, 'wet'))
    await syncOnce(a, server.api)
    expect(server.pushes()).toBe(2)
    expect(a.outbox.size).toBe(0)
    await syncOnce(b, server.api)
    expect(b.events.size).toBe(620)
  })
})

import type { Event, PullResponse } from '@bobo/shared'
import { fakeText } from '@tanstack/ai/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadAccess } from '../src/access'
import { type AgentScope, SESSION_IDLE_MS, runAgent } from '../src/agent/run'
import { createTestApp } from './app'
import { baby } from './fixtures'

const diaper = {
  type: 'diaper',
  baby: null,
  time: null,
  minutesAgo: null,
  durationMinutes: null,
  diaper: null,
  amountMl: null,
  milk: null,
  side: null,
  food: null,
  celsius: null,
  medicine: null,
  dose: null,
  text: null,
}

describe('voice agent', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let headers: Headers
  let scope: AgentScope
  const fake = fakeText()
  const NOW = Date.UTC(2026, 9, 17, 2, 0)

  const events = async () => {
    const res = await t.request('/api/sync/pull?cursor=', { headers })
    const page = (await res.json()) as PullResponse
    return page.events.filter((event: Event) => event.deletedAt === null)
  }

  beforeAll(async () => {
    t = await createTestApp()
    const signedIn = await t.signIn()
    headers = signedIn.headers
    const res = await t.send('POST', '/api/families', headers, { name: '我们家' })
    const family: { id: string } = await res.json()
    await t.send('POST', '/api/sync/push', headers, {
      babies: [baby(family.id, { name: '小米粒' })],
      events: [],
    })
    const access = await loadAccess(t.env.DB, signedIn.user.id)
    scope = {
      db: t.env.DB,
      access,
      family: access.get(family.id)!,
      userId: signedIn.user.id,
      timeZone: 'Asia/Shanghai',
      phrase: '记录宝宝',
    }
  })
  afterAll(() => t.dispose())

  it('records through the record tool and remembers the conversation', async () => {
    fake.setResponses([
      { toolCalls: [{ name: 'record', input: { actions: [diaper] } }] },
      { text: '记好了，换了尿布。还有吗？' },
    ])
    const turn = await runAgent(fake, scope, '换尿布了', NOW)
    expect(turn).toEqual({ reply: '记好了，换了尿布。还有吗？', done: false, confirming: false })
    expect((await events()).map((event) => event.type)).toEqual(['diaper'])

    let seen = 0
    fake.setResponses([
      ({ request }) => {
        seen = request.messages.length
        return { toolCalls: [{ name: 'end_conversation', input: {} }] }
      },
      { text: '好的，再见。' },
    ])
    const end = await runAgent(fake, scope, '没有了', NOW + 60_000)
    expect(end).toMatchObject({ done: true, reply: '好的，再见。' })
    // The earlier turn (message, tool call, result, answer) came along.
    expect(seen).toBeGreaterThan(3)
  })

  it('asks before deleting, and deletes on yes', async () => {
    const [stored] = await events()
    fake.setResponses([{ toolCalls: [{ name: 'delete_event', input: { id: stored?.id } }] }])
    const ask = await runAgent(fake, scope, '删掉刚才那条', NOW + 120_000)
    expect(ask.confirming).toBe(true)
    expect(ask.reply).toMatch(/^要删除「小米粒 \d\d:\d\d 换尿布（尿尿）」吗？$/)
    expect(await events()).toHaveLength(1)

    fake.setResponses([{ text: '删掉了。' }])
    const done = await runAgent(fake, scope, '对', NOW + 150_000)
    expect(done.reply).toBe('删掉了。')
    expect(await events()).toHaveLength(0)
  })

  it('keeps the record when the user says no', async () => {
    fake.setResponses([
      { toolCalls: [{ name: 'record', input: { actions: [diaper] } }] },
      { text: '记好了。' },
    ])
    await runAgent(fake, scope, '换尿布了', NOW + 200_000)
    const [stored] = await events()
    fake.setResponses([{ toolCalls: [{ name: 'delete_event', input: { id: stored?.id } }] }])
    await runAgent(fake, scope, '删掉', NOW + 210_000)
    fake.setResponses([{ text: '好，不删。' }])
    const kept = await runAgent(fake, scope, '不要', NOW + 220_000)
    expect(kept.reply).toBe('好，不删。')
    expect(await events()).toHaveLength(1)
  })

  it('undoes the last change', async () => {
    fake.setResponses([
      { toolCalls: [{ name: 'record', input: { actions: [diaper] } }] },
      { text: '记好了。' },
    ])
    await runAgent(fake, scope, '又换了尿布', NOW + 300_000)
    expect(await events()).toHaveLength(2)
    fake.setResponses([{ toolCalls: [{ name: 'undo', input: {} }] }, { text: '撤销了。' }])
    await runAgent(fake, scope, '撤销', NOW + 310_000)
    expect(await events()).toHaveLength(1)
  })

  it('starts a new conversation after a pause', async () => {
    let seen = 0
    fake.setResponses([
      ({ request }) => {
        seen = request.messages.length
        return { text: '你好。' }
      },
    ])
    await runAgent(fake, scope, '你好', NOW + 310_000 + SESSION_IDLE_MS + 1)
    expect(seen).toBe(1)
  })
})

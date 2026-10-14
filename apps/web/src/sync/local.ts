import type { Baby, Event, FamilySummary } from '@bobo/shared'

import type { LocalStore } from '../db'

export type SyncTable = 'babies' | 'events'

/** Signed-in account. Absent while signed out. */
export interface SyncAccount {
  userId: string
  /** Shown in the name of the family created for the user's own babies. */
  userName?: string
  /**
   * Family new babies go to by default; null until the user has one of their own (a family is
   * created for them when they first add a baby, see fileUnclaimed in runner.ts).
   */
  familyId: string | null
}

const ACCOUNT_KEY = 'account'
const CURSOR_KEY = 'cursor'
const ACCESS_KEY = 'access'

const outboxKey = (table: SyncTable, id: string) => `${table}:${id}`

function setMeta(store: LocalStore, key: string, value: unknown) {
  if (store.meta.has(key)) {
    store.meta.update(key, (draft) => {
      draft.value = value
    })
  } else {
    store.meta.insert({ key, value })
  }
}

function isAccount(value: unknown): value is SyncAccount {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    typeof value.userId === 'string' &&
    'familyId' in value &&
    (typeof value.familyId === 'string' || value.familyId === null)
  )
}

export function getAccount(store: LocalStore): SyncAccount | undefined {
  const value = store.meta.get(ACCOUNT_KEY)?.value
  return isAccount(value) ? value : undefined
}

export function setAccount(store: LocalStore, account: SyncAccount | undefined) {
  if (account) setMeta(store, ACCOUNT_KEY, account)
  else if (store.meta.has(ACCOUNT_KEY)) store.meta.delete(ACCOUNT_KEY)
}

export function getCursor(store: LocalStore): string {
  const value = store.meta.get(CURSOR_KEY)?.value
  return typeof value === 'string' ? value : ''
}

export function setCursor(store: LocalStore, cursor: string) {
  setMeta(store, CURSOR_KEY, cursor)
}

/** Records a local change for the next push. Remote changes must not go through here. */
export function markDirty(store: LocalStore, table: SyncTable, record: Baby | Event) {
  const key = outboxKey(table, record.id)
  if (store.outbox.has(key)) {
    store.outbox.update(key, (draft) => {
      draft.updatedAt = record.updatedAt
    })
  } else {
    store.outbox.insert({ key, table, id: record.id, updatedAt: record.updatedAt })
  }
}

/** Clears an entry only if the record has not changed again since it was pushed. */
export function clearDirty(
  store: LocalStore,
  table: SyncTable,
  id: string,
  pushedUpdatedAt: number,
) {
  const key = outboxKey(table, id)
  const entry = store.outbox.get(key)
  if (entry && entry.updatedAt <= pushedUpdatedAt) store.outbox.delete(key)
}

export function isDirty(store: LocalStore, table: SyncTable, id: string): boolean {
  return store.outbox.has(outboxKey(table, id))
}

/** Family for new records: the signed-in account's family, or none while signed out. */
export function currentFamilyId(store: LocalStore): string | null {
  return getAccount(store)?.familyId ?? null
}

function isFamilySummary(value: unknown): value is FamilySummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'role' in value &&
    typeof value.role === 'string' &&
    'babyIds' in value &&
    (value.babyIds === null || Array.isArray(value.babyIds))
  )
}

/** Families the account can access, as of the last pull; undefined before the first one. */
export function getAccess(store: LocalStore): FamilySummary[] | undefined {
  const value = store.meta.get(ACCESS_KEY)?.value
  return Array.isArray(value) ? value.filter(isFamilySummary) : undefined
}

export function setAccess(store: LocalStore, access: FamilySummary[] | undefined) {
  if (access) setMeta(store, ACCESS_KEY, access)
  else if (store.meta.has(ACCESS_KEY)) store.meta.delete(ACCESS_KEY)
}

/** Removes a record and its pending change without queueing anything for the server. */
export function removeLocal(store: LocalStore, table: SyncTable, id: string) {
  const collection = table === 'babies' ? store.babies : store.events
  if (collection.has(id)) collection.delete(id)
  const key = outboxKey(table, id)
  if (store.outbox.has(key)) store.outbox.delete(key)
}

/** Babies not yet in any family: created while signed out, or for a new family of the user's. */
export function unclaimedCount(store: LocalStore): number {
  return store.babies.toArray.filter((b) => b.familyId === null && b.deletedAt === null).length
}

/**
 * Moves every baby and event without a family into one and queues them for upload.
 * Events follow their baby, so a family's events always travel with its babies.
 */
export function claimLocalData(store: LocalStore, familyId: string, now: number = Date.now()) {
  for (const baby of store.babies.toArray) {
    if (baby.familyId !== null) continue
    const updatedAt = Math.max(now, baby.updatedAt)
    store.babies.update(baby.id, (draft) => Object.assign(draft, { familyId, updatedAt }))
    markDirty(store, 'babies', { ...baby, familyId, updatedAt })
  }
  for (const event of store.events.toArray) {
    if (event.familyId !== null) continue
    const babyFamily = store.babies.get(event.babyId)?.familyId ?? familyId
    const updatedAt = Math.max(now, event.updatedAt)
    store.events.update(event.id, (draft) =>
      Object.assign(draft, { familyId: babyFamily, updatedAt }),
    )
    markDirty(store, 'events', { ...event, familyId: babyFamily, updatedAt })
  }
}

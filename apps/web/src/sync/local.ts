import type { Baby, Event } from '@bobo/shared'

import type { LocalStore } from '../db'

export type SyncTable = 'babies' | 'events'

/** Signed-in account and the family new records belong to. Absent while signed out. */
export interface SyncAccount {
  userId: string
  familyId: string
}

const ACCOUNT_KEY = 'account'
const CURSOR_KEY = 'cursor'

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
    typeof value.familyId === 'string'
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

import {
  type Baby,
  type Event,
  type PushItemResult,
  type PushRejectReason,
  babySchema,
  eventSchema,
} from '@bobo/shared'

/** Position in one table's change stream: rows are ordered by (seq, id). */
export type TableCursor = [seq: number, id: string]
export interface SyncCursor {
  babies: TableCursor
  events: TableCursor
}

const START: TableCursor = [0, '']

export function encodeCursor(cursor: SyncCursor): string {
  return btoa(JSON.stringify([cursor.babies, cursor.events]))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function isTableCursor(value: unknown): value is TableCursor {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isSafeInteger(value[0]) &&
    typeof value[1] === 'string'
  )
}

/** Unknown or malformed cursors restart from the beginning (a full, idempotent re-pull). */
export function decodeCursor(value: string | undefined): SyncCursor {
  if (!value) return { babies: START, events: START }
  try {
    const parsed: unknown = JSON.parse(atob(value.replaceAll('-', '+').replaceAll('_', '/')))
    if (Array.isArray(parsed) && isTableCursor(parsed[0]) && isTableCursor(parsed[1])) {
      return { babies: parsed[0], events: parsed[1] }
    }
  } catch {
    // Fall through to a fresh cursor.
  }
  return { babies: START, events: START }
}

interface ExistingRow {
  id: string
  familyId: string | null
  updatedAt: number
  createdBy: string | null
}

export interface PlannedWrite<T> {
  results: PushItemResult[]
  /** Validated records to upsert, with server-controlled fields applied. */
  writes: T[]
}

/**
 * Decides per item whether it can be stored. Last write wins by updatedAt; records may not
 * move between families; createdBy is assigned by the server on first write and immutable.
 */
export function planWrites<T extends Baby | Event>(
  items: readonly unknown[],
  parse: (item: unknown) => T | undefined,
  existing: ReadonlyMap<string, ExistingRow>,
  writableFamilies: ReadonlySet<string>,
  userId: string,
): PlannedWrite<T> {
  const results: PushItemResult[] = []
  const writes: T[] = []
  const reject = (id: string, reason: PushRejectReason) =>
    results.push({ id, status: 'rejected', reason })

  for (const item of items) {
    const record = parse(item)
    if (!record) {
      const id = typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : ''
      reject(id, 'invalid')
      continue
    }
    if (record.familyId === null || !writableFamilies.has(record.familyId)) {
      reject(record.id, 'forbidden')
      continue
    }
    const current = existing.get(record.id)
    if (current && current.familyId !== record.familyId) {
      reject(record.id, 'family_mismatch')
      continue
    }
    if (current && current.updatedAt > record.updatedAt) {
      results.push({ id: record.id, status: 'stale' })
      continue
    }
    writes.push({ ...record, createdBy: current ? current.createdBy : userId })
    results.push({ id: record.id, status: 'accepted' })
  }
  return { results, writes }
}

export const parseBaby = (item: unknown): Baby | undefined => babySchema.safeParse(item).data
export const parseEvent = (item: unknown): Event | undefined => eventSchema.safeParse(item).data

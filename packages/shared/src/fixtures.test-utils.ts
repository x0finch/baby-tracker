import { newId } from './id'

export const T0 = Date.UTC(2026, 9, 13, 8, 0)
export const MINUTE = 60_000

export function syncMeta() {
  return { createdAt: T0, updatedAt: T0, deletedAt: null, createdBy: null }
}

export function baseEvent() {
  return { id: newId(), babyId: newId(), familyId: null, note: null, ...syncMeta() }
}

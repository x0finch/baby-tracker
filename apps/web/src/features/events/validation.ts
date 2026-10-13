import type { Event } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'
import { fromDateTimeLocal } from './time'

/** Small allowance so "now" picked in the form is not rejected a few seconds later. */
const FUTURE_TOLERANCE_MS = 60_000

export function validateTime(value: string, now: number): { at: number } | { error: string } {
  const at = fromDateTimeLocal(value)
  if (Number.isNaN(at)) return { error: m.timeInvalid() }
  if (at > now + FUTURE_TOLERANCE_MS) return { error: m.timeInFuture() }
  return { at: Math.min(at, now) }
}

/** Whether [startAt, endAt] overlaps another sleep of the same baby (running sleeps count to now). */
export function overlapsSleep(
  events: readonly Event[],
  startAt: number,
  endAt: number,
  now: number,
  ignoreId?: string,
): boolean {
  return events.some(
    (event) =>
      event.type === 'sleep' &&
      event.id !== ignoreId &&
      event.deletedAt === null &&
      event.startAt < endAt &&
      (event.endAt ?? now) > startAt,
  )
}

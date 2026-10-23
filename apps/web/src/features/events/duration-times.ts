import { type BreastSide, MINUTE } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'
import type { DurationKind } from './kinds'

/**
 * When a duration record started and how long it took, as the logging and edit sheets hold
 * them. Every way of changing start, duration or end goes through `timesReducer`, so they
 * stay in step the same way everywhere.
 */
export interface DurationTimes {
  kind: DurationKind
  /** When it started; null until one is picked: then it is taken to have just ended. */
  startAt: number | null
  /** The "N 分钟前" choice that set the start, if any. */
  startedAgo: number | null
  /** How long it took, in minutes; null when not recorded. Breastfeeds use `sides`. */
  minutes: number | null
  /** Breastfeeds: minutes on each side, `firstSide` first. */
  sides: Record<BreastSide, number | null>
  firstSide: BreastSide
}

export type DurationTimesAction =
  | { type: 'startedAgo'; minutes: number; now: number }
  | { type: 'start'; at: number }
  | { type: 'end'; at: number; now: number }
  | { type: 'minutes'; minutes: number | null }
  | { type: 'side'; side: BreastSide; minutes: number | null }
  | { type: 'firstSide'; side: BreastSide }

export function totalMinutes(times: DurationTimes): number | null {
  if (times.kind !== 'breast') return times.minutes
  const total = (times.sides.left ?? 0) + (times.sides.right ?? 0)
  return total > 0 ? total : null
}

/** The start and end these times give at `now`; the end is null without a duration. */
export function resolveTimes(
  times: DurationTimes,
  now: number,
): { startAt: number; endAt: number | null } {
  const total = totalMinutes(times)
  const startAt = times.startAt ?? now - (total ?? 0) * MINUTE
  return { startAt, endAt: total === null ? null : startAt + total * MINUTE }
}

/** New total minutes, taken from the side fed last (the other side keeps its minutes). */
function withTotal(times: DurationTimes, total: number): DurationTimes {
  if (times.kind !== 'breast') return { ...times, minutes: total > 0 ? total : null }
  const other: BreastSide = times.firstSide === 'left' ? 'right' : 'left'
  const last = (times.sides[other] ?? 0) > 0 ? other : times.firstSide
  const kept = last === times.firstSide ? 0 : (times.sides[times.firstSide] ?? 0)
  return { ...times, sides: { ...times.sides, [last]: Math.max(0, total - kept) || null } }
}

/**
 * - a new start keeps the duration (the end moves with it);
 * - a new duration keeps the start, or, while the start is not picked, keeps the end at now;
 * - a new end keeps the start and changes the duration; an end before the start moves the
 *   start instead, keeping the duration.
 */
export function timesReducer(times: DurationTimes, action: DurationTimesAction): DurationTimes {
  switch (action.type) {
    case 'startedAgo':
      return { ...times, startAt: action.now - action.minutes * MINUTE, startedAgo: action.minutes }
    case 'start':
      return { ...times, startAt: action.at, startedAgo: null }
    case 'minutes':
      return { ...times, minutes: action.minutes }
    case 'side':
      return { ...times, sides: { ...times.sides, [action.side]: action.minutes } }
    case 'firstSide':
      return { ...times, firstSide: action.side }
    case 'end': {
      const { startAt } = resolveTimes(times, action.now)
      const total = totalMinutes(times) ?? 0
      if (action.at < startAt || times.startAt === null) {
        // Keep how long it took; the start follows the end.
        return { ...times, startAt: action.at - total * MINUTE, startedAgo: null }
      }
      return withTotal(times, Math.round((action.at - startAt) / MINUTE))
    }
    default:
      return action satisfies never
  }
}

const NO_SIDES: Record<BreastSide, number | null> = { left: null, right: null }

/** Times for logging afterwards: the usual duration, just ended. */
export function newTimes(kind: DurationKind, usualMinutes: number, firstSide: BreastSide) {
  return {
    kind,
    startAt: null,
    startedAgo: null,
    minutes: kind === 'breast' ? null : usualMinutes,
    sides: kind === 'breast' ? { ...NO_SIDES, [firstSide]: usualMinutes } : NO_SIDES,
    firstSide,
  } satisfies DurationTimes
}

const toMinutes = (ms: number) => (ms > 0 ? Math.max(1, Math.round(ms / MINUTE)) : null)

/** Times of a stored record, for editing. */
export function storedTimes(
  kind: DurationKind,
  startAt: number,
  durationMs: number | null,
  sides: Record<BreastSide, number> | null,
  firstSide: BreastSide,
): DurationTimes {
  return {
    kind,
    startAt,
    startedAgo: null,
    minutes: durationMs === null ? null : toMinutes(durationMs),
    sides: sides ? { left: toMinutes(sides.left), right: toMinutes(sides.right) } : NO_SIDES,
    firstSide,
  }
}

/** What blocks saving these times: a start or end in the future, or no duration when needed. */
export function checkTimes(
  times: DurationTimes,
  now: number,
  needsDuration: boolean,
): { start?: string; end?: string; duration?: string } {
  const { startAt, endAt } = resolveTimes(times, now)
  // A minute of slack: "now" picked in the form is not refused a few seconds later.
  const future = (at: number) => at > now + MINUTE
  return {
    ...(future(startAt) && { start: m.timeInFuture() }),
    ...(endAt !== null && future(endAt) && { end: m.durationEndFuture() }),
    ...(needsDuration && totalMinutes(times) === null && { duration: m.durationRequired() }),
  }
}

import { type Event, isRunning } from '@bobo/shared'

import { ageInMonths } from '../growth/growth'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Typical awake time between sleeps by age, in minutes: [from month, shortest, longest].
 * Based on common pediatric sleep guidance; individual babies vary.
 */
const WAKE_WINDOWS: readonly (readonly [number, number, number])[] = [
  [0, 35, 60],
  [1, 60, 90],
  [3, 75, 120],
  [4, 90, 150],
  [5, 120, 180],
  [7, 150, 210],
  [9, 165, 240],
  [11, 180, 270],
  [13, 240, 330],
  [19, 300, 360],
]

/** Wake windows from the last week inform the prediction, once there are this many. */
const MIN_SAMPLES = 3
const HISTORY = 7 * DAY

export function ageWakeWindow(months: number): { min: number; max: number } {
  let row = WAKE_WINDOWS[0]
  for (const candidate of WAKE_WINDOWS) if (months >= candidate[0]) row = candidate
  const [, min = 60, max = 90] = row ?? []
  return { min: min * MINUTE, max: max * MINUTE }
}

export type NextSleep =
  | { status: 'sleeping' }
  | { status: 'unknown' }
  | {
      status: 'predicted'
      /** When the baby last woke up. */
      awakeSince: number
      from: number
      to: number
      /** Whether recent sleeps shaped the window, not only the baby's age. */
      personalized: boolean
    }

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/**
 * Suggests when the baby is likely ready to sleep again: the age-typical wake window after the
 * last wake-up, centered on the baby's own recent wake windows when there are enough of them.
 */
export function predictNextSleep(
  events: readonly Event[],
  birthDate: string,
  now: number,
): NextSleep {
  const sleeps = events
    .filter((event) => event.type === 'sleep' && event.deletedAt === null)
    .toSorted((a, b) => a.startAt - b.startAt)
  if (sleeps.some((sleep) => isRunning(sleep))) return { status: 'sleeping' }
  const last = sleeps.at(-1)
  if (!last || last.endAt === null) return { status: 'unknown' }

  const age = ageWakeWindow(ageInMonths(birthDate, now))
  const ageMid = (age.min + age.max) / 2
  // Gaps between consecutive sleeps; very long ones are missed logs, not wake windows.
  const samples: number[] = []
  for (let i = 1; i < sleeps.length; i++) {
    const before = sleeps[i - 1]
    const after = sleeps[i]
    if (!before?.endAt || !after || after.startAt < now - HISTORY) continue
    const gap = after.startAt - before.endAt
    if (gap > 0 && gap <= age.max * 2) samples.push(gap)
  }

  const personalized = samples.length >= MIN_SAMPLES
  // The baby's own rhythm, kept within a plausible distance of what's typical for the age.
  const center = personalized
    ? Math.min(Math.max(median(samples), age.min * 0.75), age.max * 1.25)
    : ageMid
  const halfWidth = Math.max(15 * MINUTE, (age.max - age.min) / 4)
  const round = (time: number) => Math.round(time / (5 * MINUTE)) * 5 * MINUTE
  // Long past the window the last wake-up is probably a missed log; don't guess.
  if (now > last.endAt + center + halfWidth + age.max) return { status: 'unknown' }
  return {
    status: 'predicted',
    awakeSince: last.endAt,
    from: round(last.endAt + center - halfWidth),
    to: round(last.endAt + center + halfWidth),
    personalized,
  }
}

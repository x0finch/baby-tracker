import { type Event, breastSideDurations, eventDurationMs, isTimed } from '@bobo/shared'

export interface DaySummary {
  feedings: number
  bottleMl: number
  breastMs: number
  sleepMs: number
  naps: number
  longestSleepMs: number
  diapers: { wet: number; dirty: number; mixed: number }
  pumpingMl: number
  /** The day's most recent temperature reading, if any. */
  latestCelsius: number | null
  medications: number
  notes: number
}

/** Part of [startAt, endAt) that falls within the day; running events count up to `now`. */
export function overlapMs(event: Event, dayStart: number, dayEnd: number, now: number): number {
  const end = Math.min(event.endAt ?? now, dayEnd)
  return Math.max(0, end - Math.max(event.startAt, dayStart))
}

function inDay(at: number, dayStart: number, dayEnd: number) {
  return at >= dayStart && at < dayEnd
}

/**
 * Totals for one local day. Instant events count on the day they happened; sleep time is
 * clipped to the day so a night crossing midnight is split between both days.
 */
export function summarizeDay(
  events: readonly Event[],
  dayStart: number,
  dayEnd: number,
  now: number,
): DaySummary {
  const summary: DaySummary = {
    feedings: 0,
    bottleMl: 0,
    breastMs: 0,
    sleepMs: 0,
    naps: 0,
    longestSleepMs: 0,
    diapers: { wet: 0, dirty: 0, mixed: 0 },
    pumpingMl: 0,
    latestCelsius: null,
    medications: 0,
    notes: 0,
  }
  let latestTemperatureAt = -Infinity

  for (const event of events) {
    if (event.deletedAt !== null) continue
    if (event.type === 'sleep') {
      const ms = overlapMs(event, dayStart, dayEnd, now)
      if (ms === 0) continue
      summary.sleepMs += ms
      summary.longestSleepMs = Math.max(summary.longestSleepMs, eventDurationMs(event, now))
      if (event.data.kind === 'nap' && inDay(event.startAt, dayStart, dayEnd)) summary.naps += 1
      continue
    }
    if (!inDay(event.startAt, dayStart, dayEnd)) continue
    switch (event.type) {
      case 'diaper':
        summary.diapers[event.data.contents] += 1
        continue
      case 'pumping':
        summary.pumpingMl += event.data.amountMl
        continue
      case 'temperature':
        if (event.startAt > latestTemperatureAt) {
          latestTemperatureAt = event.startAt
          summary.latestCelsius = event.data.celsius
        }
        continue
      case 'medication':
        summary.medications += 1
        continue
      case 'note':
        summary.notes += 1
        continue
      case 'feeding':
        break
    }
    summary.feedings += 1
    if (event.data.kind === 'bottle') summary.bottleMl += event.data.amountMl
    if (event.data.kind === 'breast') {
      const sides = breastSideDurations(event.data.segments, now)
      summary.breastMs += sides.left + sides.right
    }
  }
  return summary
}

/** Most recent event of a category, for "time since last" hints. Timed events count from their end. */
export function lastActivityAt(
  events: readonly Event[],
  type: Event['type'],
  now: number,
): number | undefined {
  let latest: number | undefined
  for (const event of events) {
    if (event.deletedAt !== null || event.type !== type) continue
    const at = isTimed(event) ? (event.endAt ?? now) : event.startAt
    if (latest === undefined || at > latest) latest = at
  }
  return latest
}

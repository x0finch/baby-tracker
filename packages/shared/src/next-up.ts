import { ageNorms } from './age-norms'
import { DAY, MINUTE } from './date'
import type { Event } from './event'
import { RECORD_KINDS } from './record-kinds'

/** A suggested time, give or take: never a target, babies vary. */
export interface Window {
  from: number
  to: number
  /** Whether the baby's own recent records shaped it, not only their age. */
  personalized: boolean
}

export type NextFeed =
  | { status: 'feeding' }
  | { status: 'unknown' }
  | ({ status: 'predicted'; since: number } & Window)

export type NextSleep =
  | { status: 'sleeping'; night: boolean }
  | { status: 'unknown' }
  | ({
      status: 'predicted'
      /** When the baby last woke up. */
      since: number
      /** Whether this sleep is the night's, not a nap. */
      bedtime: boolean
    } & Window)

export type NextDiaper = { status: 'unknown' } | ({ status: 'predicted'; since: number } & Window)

export interface PlanItem {
  kind: 'feed' | 'nap' | 'bedtime'
  at: number
}

export interface NextUp {
  /** Asleep for the night: only feeds are suggested. */
  night: boolean
  feed: NextFeed
  sleep: NextSleep
  diaper: NextDiaper
  /** Roughly how the rest of the day (or night) goes from here. */
  plan: PlanItem[]
  /** The usual daytime time from one feed, and one diaper change, to the next. */
  feedEvery: number
  diaperEvery: number
}

export interface NextUpOptions {
  /** Age in months, whole or fractional. */
  months: number
  now: number
  /** Minutes since local midnight at an instant; the device's clock unless given. */
  minuteOfDay?: (at: number) => number
}

/** Rhythms are read from this far back, the latest days counting the most. */
const HISTORY = 7 * DAY
/** Each day further back counts half as much. */
const HALF_LIFE = DAY
/** Fewer intervals than this and the age's usual one is used. */
const MIN_SAMPLES = 3
/** Awake less than this between two sleeps (a stir, a transfer) and they are one sleep. */
const SLEEP_JOIN = 15 * MINUTE
/** Feeds this close together are one feed, at most. */
const FEED_JOIN_MAX = 45 * MINUTE
const BEDTIME = 20 * 60
const WAKE_TIME = 7 * 60
const MINUTES_A_DAY = 24 * 60
const PLAN_LIMIT = 12

const deviceMinute = (at: number) => {
  const date = new Date(at)
  return date.getHours() * 60 + date.getMinutes()
}

type Range = readonly [number, number]

interface Sample {
  value: number
  at: number
}

/** Feeds or sleeps close enough together to count as one. */
interface Session {
  startAt: number
  /** Null while it runs. */
  endAt: number | null
  night: boolean
}

function sessions(events: readonly Event[], join: number): Session[] {
  const joined: Session[] = []
  for (const event of events.toSorted((a, b) => a.startAt - b.startAt)) {
    const night = event.type === 'sleep' && event.data.kind === 'night'
    const last = joined.at(-1)
    if (last && (last.endAt === null || event.startAt - last.endAt <= join)) {
      last.endAt =
        last.endAt === null || event.endAt === null ? null : Math.max(last.endAt, event.endAt)
      last.night ||= night
    } else {
      joined.push({ startAt: event.startAt, endAt: event.endAt, night })
    }
  }
  return joined
}

/** The value where half the weight lies on each side; recent samples weigh more. */
function weightedMedian(samples: readonly Sample[], now: number): number {
  const weighted = samples
    .map((sample) => ({ value: sample.value, weight: 0.5 ** ((now - sample.at) / HALF_LIFE) }))
    .toSorted((a, b) => a.value - b.value)
  const half = weighted.reduce((sum, sample) => sum + sample.weight, 0) / 2
  let sum = 0
  for (const sample of weighted) {
    sum += sample.weight
    if (sum >= half) return sample.value
  }
  return weighted.at(-1)?.value ?? 0
}

interface Rhythm {
  /** The usual interval. */
  center: number
  /** Give or take. */
  spread: number
  /** Past this after the last one, it was probably not logged: don't guess. */
  giveUp: number
  personalized: boolean
}

/** The usual interval: the baby's own when there are enough samples, near the age's. */
function rhythm(samples: readonly Sample[], [min, max]: Range, now: number): Rhythm {
  const personalized = samples.length >= MIN_SAMPLES
  const center = personalized
    ? Math.min(Math.max(weightedMedian(samples, now), min * 0.75), max * 1.25)
    : (min + max) / 2
  const spread = Math.max(15 * MINUTE, (max - min) / 4)
  return { center, spread, giveUp: center + spread + max, personalized }
}

const window = (start: number, { center, spread, personalized }: Rhythm): Window => ({
  from: round(start + center - spread),
  to: round(start + center + spread),
  personalized,
})

/** Rounds to the nearest 5 minutes, so suggestions read as plain clock times. */
const round = (time: number) => Math.round(time / (5 * MINUTE)) * 5 * MINUTE

const minutes = ([min, max]: Range): Range => [min * MINUTE, max * MINUTE]

/** Gaps from the start of one session to the start of the next, within the last week. */
function startGaps(list: readonly Session[], now: number, cap: number): Sample[] {
  const samples: Sample[] = []
  for (let i = 1; i < list.length; i++) {
    const before = list[i - 1]
    const after = list[i]
    if (!before || !after || before.startAt < now - HISTORY) continue
    const gap = after.startAt - before.startAt
    if (gap > 0 && gap <= cap) samples.push({ value: gap, at: before.startAt })
  }
  return samples
}

/** The typical minute of day of `times`, around `pivot` so 23:50 and 00:10 sit together. */
function usualMinute(
  times: readonly number[],
  minuteOfDay: (at: number) => number,
  pivot: number,
  now: number,
): number | null {
  if (times.length < MIN_SAMPLES) return null
  const samples = times.map((at) => {
    const minute = minuteOfDay(at)
    // Unwrapped onto the 24 hours that start half a day before the pivot.
    const value = minute < pivot - MINUTES_A_DAY / 2 ? minute + MINUTES_A_DAY : minute
    return { value, at }
  })
  return Math.round(weightedMedian(samples, now)) % MINUTES_A_DAY
}

/**
 * What comes next for a baby, from their age and their own last week: the next feed, sleep
 * and diaper change, and roughly how the rest of the day goes.
 *
 * Feeds a few minutes apart (a top-up, a bottle after the breast) are one feed, and sleeps
 * with only a short stir between them one sleep. Intervals run start to start, are read
 * from the last 7 days with the latest counting most, and day and night are kept apart:
 * night runs from the baby's usual bedtime to their usual wake-up.
 */
export function nextUp(events: readonly Event[], options: NextUpOptions): NextUp {
  const { months, now, minuteOfDay = deviceMinute } = options
  const norms = ageNorms(months)
  const live = events.filter((event) => event.deletedAt === null && event.startAt <= now)

  // Night, from the baby's own night sleeps when there are enough.
  const sleeps = sessions(
    live.filter((event) => event.type === 'sleep'),
    SLEEP_JOIN,
  )
  const nights = sleeps.filter((sleep) => sleep.night && sleep.startAt >= now - 2 * HISTORY)
  const bedtime =
    usualMinute(
      nights.map((sleep) => sleep.startAt),
      minuteOfDay,
      BEDTIME,
      now,
    ) ?? BEDTIME
  const wakeTime =
    usualMinute(
      nights.flatMap((sleep) => (sleep.endAt === null ? [] : [sleep.endAt])),
      minuteOfDay,
      WAKE_TIME,
      now,
    ) ?? WAKE_TIME
  const isNight = (at: number) => {
    const minute = minuteOfDay(at)
    return bedtime > wakeTime
      ? minute >= bedtime || minute < wakeTime
      : minute >= bedtime && minute < wakeTime
  }
  /** The next time the clock reads `minute`, after `at`. */
  const nextAt = (at: number, minute: number) =>
    at + ((minute - minuteOfDay(at) + MINUTES_A_DAY) % MINUTES_A_DAY) * MINUTE

  const lastSleep = sleeps.at(-1)
  const night =
    isNight(now) &&
    lastSleep !== undefined &&
    lastSleep.night &&
    lastSleep.startAt > now - DAY / 1.5

  // Feeds: close ones joined, day and night intervals apart.
  const feedRange = minutes(norms.feedIntervalMinutes)
  const feeds = sessions(
    live.filter((event) => event.type === 'feeding'),
    Math.min(FEED_JOIN_MAX, feedRange[0] / 4),
  )
  const gaps = startGaps(feeds, now, 12 * 60 * MINUTE)
  const dayFeeds = rhythm(
    gaps.filter((gap) => !isNight(gap.at) && gap.value <= feedRange[1] * 2.5),
    feedRange,
    now,
  )
  const nightFeeds = rhythm(
    gaps.filter((gap) => isNight(gap.at)),
    [feedRange[0], feedRange[1] * 2],
    now,
  )
  const feedRhythm = (at: number) => (isNight(at) ? nightFeeds : dayFeeds)

  const lastFeed = feeds.at(-1)
  let feed: NextFeed = { status: 'unknown' }
  if (lastFeed?.endAt === null) feed = { status: 'feeding' }
  else if (lastFeed && now <= lastFeed.startAt + feedRhythm(lastFeed.startAt).giveUp) {
    feed = {
      status: 'predicted',
      since: lastFeed.startAt,
      ...window(lastFeed.startAt, feedRhythm(lastFeed.startAt)),
    }
  }

  // Sleep: the wake window after the last wake-up, or bedtime once that comes first.
  const wakeRange = minutes(norms.wakeMinutes)
  const wakes: Sample[] = []
  for (let i = 1; i < sleeps.length; i++) {
    const before = sleeps[i - 1]
    const after = sleeps[i]
    if (!before?.endAt || !after || after.startAt < now - HISTORY) continue
    const gap = after.startAt - before.endAt
    if (gap > 0 && gap <= wakeRange[1] * 2) wakes.push({ value: gap, at: after.startAt })
  }
  const awake = rhythm(wakes, wakeRange, now)
  const naps = sleeps.filter(
    (sleep) => !sleep.night && sleep.endAt !== null && sleep.startAt >= now - HISTORY,
  )
  const napLength =
    naps.length >= MIN_SAMPLES
      ? weightedMedian(
          naps.map((nap) => ({ value: (nap.endAt ?? nap.startAt) - nap.startAt, at: nap.startAt })),
          now,
        )
      : RECORD_KINDS.sleep.usualMinutes * MINUTE
  const bedtimePersonalized = nights.length >= MIN_SAMPLES

  /** The next sleep after waking at `wokeAt`: a nap, or the night's once bedtime is near. */
  const sleepAfter = (wokeAt: number) => {
    const nap = wokeAt + awake.center
    const bed = nextAt(wokeAt, bedtime)
    return nap + awake.spread >= bed || isNight(nap)
      ? { at: bed, bedtime: true }
      : { at: nap, bedtime: false }
  }

  let sleep: NextSleep = { status: 'unknown' }
  if (lastSleep?.endAt === null) sleep = { status: 'sleeping', night: lastSleep.night }
  else if (lastSleep?.endAt && now <= lastSleep.endAt + awake.giveUp) {
    const next = sleepAfter(lastSleep.endAt)
    sleep = next.bedtime
      ? {
          status: 'predicted',
          since: lastSleep.endAt,
          bedtime: true,
          from: round(next.at - 15 * MINUTE),
          to: round(next.at + 15 * MINUTE),
          personalized: bedtimePersonalized,
        }
      : {
          status: 'predicted',
          since: lastSleep.endAt,
          bedtime: false,
          ...window(lastSleep.endAt, awake),
        }
  }

  // Diapers: daytime changes only.
  const diaperRange = minutes(norms.diaperIntervalMinutes)
  const diapers = live
    .filter((event) => event.type === 'diaper')
    .toSorted((a, b) => a.startAt - b.startAt)
    .map((event) => ({ startAt: event.startAt, endAt: event.startAt, night: false }))
  const diaperRhythm = rhythm(
    startGaps(diapers, now, diaperRange[1] * 2.5).filter((gap) => !isNight(gap.at)),
    diaperRange,
    now,
  )
  const lastDiaper = diapers.at(-1)
  const diaper: NextDiaper =
    !night && lastDiaper && now <= lastDiaper.startAt + diaperRhythm.giveUp
      ? {
          status: 'predicted',
          since: lastDiaper.startAt,
          ...window(lastDiaper.startAt, diaperRhythm),
        }
      : { status: 'unknown' }

  // The rest of the day: feeds and naps in turn until bedtime, or feeds until morning.
  const plan: PlanItem[] = []
  const end = night ? nextAt(now, wakeTime) : nextAt(now, bedtime)
  let nextFeed =
    feed.status === 'predicted'
      ? (feed.from + feed.to) / 2
      : feed.status === 'feeding' && lastFeed
        ? lastFeed.startAt + feedRhythm(lastFeed.startAt).center
        : null
  let nextSleep: { at: number; bedtime: boolean } | null = null
  if (!night) {
    if (sleep.status === 'predicted') {
      nextSleep = { at: (sleep.from + sleep.to) / 2, bedtime: sleep.bedtime }
    } else if (sleep.status === 'sleeping' && lastSleep && !lastSleep.night) {
      nextSleep = sleepAfter(Math.max(now, lastSleep.startAt + napLength))
    }
  }
  while (plan.length < PLAN_LIMIT) {
    const feedFirst = nextFeed !== null && (nextSleep === null || nextFeed <= nextSleep.at)
    if (feedFirst && nextFeed !== null && nextFeed < end) {
      plan.push({ kind: 'feed', at: round(nextFeed) })
      nextFeed += feedRhythm(nextFeed).center
    } else if (nextSleep !== null) {
      plan.push({ kind: nextSleep.bedtime ? 'bedtime' : 'nap', at: round(nextSleep.at) })
      if (nextSleep.bedtime) break
      nextSleep = sleepAfter(nextSleep.at + napLength)
    } else {
      break
    }
  }

  return {
    night,
    feed,
    sleep: night && sleep.status === 'predicted' ? { status: 'unknown' } : sleep,
    diaper,
    plan,
    feedEvery: dayFeeds.center,
    diaperEvery: diaperRhythm.center,
  }
}

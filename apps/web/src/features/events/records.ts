import {
  type BreastSide,
  type DiaperEvent,
  type Event,
  type FeedingEvent,
  type SleepEvent,
  newId,
} from '@bobo/shared'

type NewEventBase = Pick<
  Event,
  'id' | 'babyId' | 'familyId' | 'note' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdBy'
>

function base(babyId: string, now: number): NewEventBase {
  return {
    id: newId(now),
    babyId,
    familyId: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
  }
}

export function startBreastFeed(babyId: string, side: BreastSide, now: number): FeedingEvent {
  return {
    ...base(babyId, now),
    type: 'feeding',
    startAt: now,
    endAt: null,
    data: { kind: 'breast', segments: [{ side, startAt: now, endAt: null }] },
  }
}

export function logBottle(
  babyId: string,
  at: number,
  amountMl: number,
  milk: 'breast' | 'formula' | 'mixed',
  now: number = at,
): FeedingEvent {
  return {
    ...base(babyId, now),
    type: 'feeding',
    startAt: at,
    endAt: null,
    data: { kind: 'bottle', amountMl, milk },
  }
}

export function logSolids(
  babyId: string,
  at: number,
  food: string,
  now: number = at,
): FeedingEvent {
  return {
    ...base(babyId, now),
    type: 'feeding',
    startAt: at,
    endAt: null,
    data: { kind: 'solids', food: food.trim() },
  }
}

/** Night sleep starts between 19:00 and 06:59 local time; anything else is a nap. */
export function sleepKindFor(startAt: number): 'nap' | 'night' {
  const hour = new Date(startAt).getHours()
  return hour >= 19 || hour < 7 ? 'night' : 'nap'
}

export function startSleep(babyId: string, now: number): SleepEvent {
  return {
    ...base(babyId, now),
    type: 'sleep',
    startAt: now,
    endAt: null,
    data: { kind: sleepKindFor(now) },
  }
}

export function logSleep(babyId: string, startAt: number, endAt: number, now: number): SleepEvent {
  return {
    ...base(babyId, now),
    type: 'sleep',
    startAt,
    endAt,
    data: { kind: sleepKindFor(startAt) },
  }
}

export function logDiaper(
  babyId: string,
  at: number,
  contents: 'wet' | 'dirty' | 'mixed',
  now: number = at,
): DiaperEvent {
  return { ...base(babyId, now), type: 'diaper', startAt: at, endAt: null, data: { contents } }
}

/** updatedAt must never move backwards, even if the device clock does. */
function touched(event: Event, now: number): number {
  return Math.max(now, event.updatedAt)
}

/** Closes the running breast segment and opens one on the other side. */
export function switchBreastSide(event: FeedingEvent, now: number): FeedingEvent {
  if (event.data.kind !== 'breast' || event.endAt !== null) return event
  const segments = event.data.segments
  const current = segments.at(-1)
  if (!current || current.endAt !== null) return event
  const at = Math.max(now, current.startAt)
  return {
    ...event,
    updatedAt: touched(event, now),
    data: {
      kind: 'breast',
      segments: [
        ...segments.slice(0, -1),
        { ...current, endAt: at },
        { side: current.side === 'left' ? 'right' : 'left', startAt: at, endAt: null },
      ],
    },
  }
}

/** Stops a running timed event (sleep or breastfeed) at `now`. */
export function stopEvent<T extends Event>(event: T, now: number): T {
  if (event.endAt !== null) return event
  const endAt = Math.max(now, event.startAt)
  if (event.type === 'feeding' && event.data.kind === 'breast') {
    const segments = event.data.segments.map((segment, index, all) =>
      index === all.length - 1 && segment.endAt === null
        ? { ...segment, endAt: Math.max(endAt, segment.startAt) }
        : segment,
    )
    const lastEnd = segments.at(-1)?.endAt ?? endAt
    return {
      ...event,
      endAt: lastEnd,
      updatedAt: touched(event, now),
      data: { ...event.data, segments },
    }
  }
  return { ...event, endAt, updatedAt: touched(event, now) }
}

export function currentBreastSide(event: FeedingEvent): BreastSide | undefined {
  if (event.data.kind !== 'breast') return undefined
  return event.data.segments.at(-1)?.side
}

/** Side to suggest for the next feed: the opposite of where the last feed ended. */
export function suggestedBreastSide(lastFeed: FeedingEvent | undefined): BreastSide {
  const last = lastFeed ? currentBreastSide(lastFeed) : undefined
  return last === 'left' ? 'right' : 'left'
}

import {
  type BreastSide,
  type DiaperEvent,
  type Event,
  type FeedingEvent,
  type GrowthEvent,
  type MedicationEvent,
  type NoteEvent,
  type PumpingEvent,
  type SleepEvent,
  type TemperatureEvent,
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
  split?: { breastMl: number; formulaMl: number },
): FeedingEvent {
  return {
    ...base(babyId, now),
    type: 'feeding',
    startAt: at,
    endAt: null,
    data: { kind: 'bottle', amountMl, milk, ...(milk === 'mixed' && split) },
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
  diaper: DiaperEvent['data'] | DiaperEvent['data']['contents'],
  now: number = at,
): DiaperEvent {
  const data = typeof diaper === 'string' ? { contents: diaper } : diaper
  return { ...base(babyId, now), type: 'diaper', startAt: at, endAt: null, data }
}

export function logPumping(
  babyId: string,
  at: number,
  side: 'left' | 'right' | 'both',
  amountMl: number,
  now: number = at,
): PumpingEvent {
  return {
    ...base(babyId, now),
    type: 'pumping',
    startAt: at,
    endAt: null,
    data: { side, amountMl },
  }
}

export function logTemperature(
  babyId: string,
  at: number,
  celsius: number,
  now: number = at,
): TemperatureEvent {
  return {
    ...base(babyId, now),
    type: 'temperature',
    startAt: at,
    endAt: null,
    data: { celsius: Math.round(celsius * 10) / 10 },
  }
}

export function logMedication(
  babyId: string,
  at: number,
  name: string,
  dose: string,
  now: number = at,
): MedicationEvent {
  return {
    ...base(babyId, now),
    type: 'medication',
    startAt: at,
    endAt: null,
    data: { name: name.trim(), dose: dose.trim() || null },
  }
}

export function logGrowth(
  babyId: string,
  at: number,
  data: GrowthEvent['data'],
  now: number = at,
): GrowthEvent {
  return { ...base(babyId, now), type: 'growth', startAt: at, endAt: null, data }
}

export function logNote(babyId: string, at: number, text: string, now: number = at): NoteEvent {
  return {
    ...base(babyId, now),
    type: 'note',
    startAt: at,
    endAt: null,
    note: text.trim(),
    data: {},
  }
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

/**
 * Moves an event to a new start time. Breastfeeds shift all segments so per-side
 * durations are kept; other events keep their end time.
 */
export function moveEventStart<T extends Event>(event: T, startAt: number, now: number): T {
  if (event.type === 'feeding' && event.data.kind === 'breast') {
    const delta = startAt - event.startAt
    const shift = (at: number | null) => (at === null ? null : at + delta)
    return {
      ...event,
      startAt,
      endAt: shift(event.endAt),
      updatedAt: touched(event, now),
      data: {
        ...event.data,
        segments: event.data.segments.map((segment) => ({
          ...segment,
          startAt: segment.startAt + delta,
          endAt: shift(segment.endAt),
        })),
      },
    }
  }
  return { ...event, startAt, updatedAt: touched(event, now) }
}

export function setEventNote<T extends Event>(event: T, note: string, now: number): T {
  const trimmed = note.trim()
  return { ...event, note: trimmed === '' ? null : trimmed, updatedAt: touched(event, now) }
}

/** Soft delete, so the deletion can sync and be undone. */
export function deleteEvent<T extends Event>(event: T, now: number): T {
  return { ...event, deletedAt: Math.max(now, event.createdAt), updatedAt: touched(event, now) }
}

export function restoreEvent<T extends Event>(event: T, now: number): T {
  return { ...event, deletedAt: null, updatedAt: touched(event, now) }
}

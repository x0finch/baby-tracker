import { z } from 'zod'

import { checkTimestamps, syncFields, timestampSchema } from './common'
import { idSchema } from './id'

export const breastSideSchema = z.enum(['left', 'right'])

export const breastSegmentSchema = z.object({
  side: breastSideSchema,
  startAt: timestampSchema,
  /** Null while this side is being fed. */
  endAt: timestampSchema.nullable(),
})

export const feedingDataSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('breast'),
    /** One segment per side switch; durations per side are derived from these. */
    segments: z.array(breastSegmentSchema).min(1).max(100),
  }),
  z.object({
    kind: z.literal('bottle'),
    /** Canonical unit is ml; other units are converted on display. */
    amountMl: z.number().positive().max(1000),
    milk: z.enum(['breast', 'formula', 'mixed']),
  }),
  z.object({
    kind: z.literal('solids'),
    food: z.string().trim().min(1).max(100),
  }),
])

export const sleepDataSchema = z.object({
  kind: z.enum(['nap', 'night']),
})

export const diaperDataSchema = z.object({
  contents: z.enum(['wet', 'dirty', 'mixed']),
})

const eventBase = {
  id: idSchema,
  babyId: idSchema,
  familyId: idSchema.nullable(),
  startAt: timestampSchema,
  /** Null while a timed event is running; always null for instant events. */
  endAt: timestampSchema.nullable(),
  note: z.string().trim().max(500).nullable(),
  ...syncFields,
}

export const eventSchema = z
  .discriminatedUnion('type', [
    z.object({ ...eventBase, type: z.literal('feeding'), data: feedingDataSchema }),
    z.object({ ...eventBase, type: z.literal('sleep'), data: sleepDataSchema }),
    z.object({ ...eventBase, type: z.literal('diaper'), data: diaperDataSchema }),
  ])
  .superRefine((event, ctx) => {
    checkTimestamps(event, ctx)

    if (event.endAt !== null && event.endAt < event.startAt) {
      ctx.addIssue({ code: 'custom', message: 'endAt must not be before startAt', path: ['endAt'] })
    }
    if (!isTimed(event) && event.endAt !== null) {
      ctx.addIssue({ code: 'custom', message: 'Instant events have no endAt', path: ['endAt'] })
    }
    if (event.type === 'feeding' && event.data.kind === 'breast') {
      checkBreastSegments(event.data.segments, event.startAt, event.endAt, ctx)
    }
  })

export type Event = z.infer<typeof eventSchema>
export type EventType = Event['type']
export type FeedingEvent = Extract<Event, { type: 'feeding' }>
export type SleepEvent = Extract<Event, { type: 'sleep' }>
export type DiaperEvent = Extract<Event, { type: 'diaper' }>
export type FeedingData = z.infer<typeof feedingDataSchema>
export type BreastSide = z.infer<typeof breastSideSchema>
export type BreastSegment = z.infer<typeof breastSegmentSchema>

/**
 * Segments must be in order without gaps or overlaps, start with the event, and only the
 * last one may be open, exactly when the event itself is still running.
 */
function checkBreastSegments(
  segments: BreastSegment[],
  startAt: number,
  endAt: number | null,
  ctx: z.RefinementCtx,
) {
  const issue = (message: string) =>
    ctx.addIssue({ code: 'custom', message, path: ['data', 'segments'] })

  if (segments[0]?.startAt !== startAt) issue('First segment must start with the event')

  segments.forEach((segment, index) => {
    const next = segments[index + 1]
    if (next) {
      if (segment.endAt === null) issue('Only the last segment may be open')
      else if (next.startAt !== segment.endAt) issue('Segments must be contiguous')
    }
    if (segment.endAt !== null && segment.endAt < segment.startAt) {
      issue('Segment ends before it starts')
    }
  })

  const lastEnd = segments.at(-1)?.endAt ?? null
  if (lastEnd !== endAt) issue('Last segment must end with the event')
}

/** Whether the event spans time (has a timer) rather than happening at an instant. */
export function isTimed(event: Pick<Event, 'type' | 'data'>): boolean {
  if (event.type === 'sleep') return true
  return event.type === 'feeding' && 'kind' in event.data && event.data.kind === 'breast'
}

export function isRunning(event: Pick<Event, 'type' | 'data' | 'endAt'>): boolean {
  return isTimed(event) && event.endAt === null
}

/** Elapsed time of a timed event; running events count up to `now`. Instants are 0. */
export function eventDurationMs(
  event: Pick<Event, 'type' | 'data' | 'startAt' | 'endAt'>,
  now: number,
): number {
  if (!isTimed(event)) return 0
  return Math.max(0, (event.endAt ?? now) - event.startAt)
}

export function breastSideDurations(
  segments: readonly BreastSegment[],
  now: number,
): Record<BreastSide, number> {
  const totals: Record<BreastSide, number> = { left: 0, right: 0 }
  for (const segment of segments) {
    totals[segment.side] += Math.max(0, (segment.endAt ?? now) - segment.startAt)
  }
  return totals
}

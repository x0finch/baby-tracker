import { describe, expect, it } from 'vitest'

import { breastSideDurations, eventDurationMs, eventSchema, isRunning, isTimed } from './event'
import { MINUTE, T0, baseEvent } from './fixtures.test-utils'

const sleep = (endAt: number | null) => ({
  ...baseEvent(),
  type: 'sleep',
  startAt: T0,
  endAt,
  data: { kind: 'nap' },
})

const breast = (
  segments: { side: string; startAt: number; endAt: number | null }[],
  endAt: number | null,
) => ({
  ...baseEvent(),
  type: 'feeding',
  startAt: T0,
  endAt,
  data: { kind: 'breast', segments },
})

describe('eventSchema', () => {
  it('accepts each event type', () => {
    expect(eventSchema.safeParse(sleep(T0 + 30 * MINUTE)).success).toBe(true)
    expect(
      eventSchema.safeParse({
        ...baseEvent(),
        type: 'diaper',
        startAt: T0,
        endAt: null,
        data: { contents: 'wet' },
      }).success,
    ).toBe(true)
    expect(
      eventSchema.safeParse({
        ...baseEvent(),
        type: 'feeding',
        startAt: T0,
        endAt: null,
        data: { kind: 'bottle', amountMl: 90, milk: 'formula' },
      }).success,
    ).toBe(true)
  })

  it('rejects data that does not match the type', () => {
    expect(eventSchema.safeParse({ ...sleep(null), data: { contents: 'wet' } }).success).toBe(false)
  })

  it('rejects an end before the start', () => {
    expect(eventSchema.safeParse(sleep(T0 - MINUTE)).success).toBe(false)
  })

  it('rejects an end time on instant events', () => {
    const bottle = {
      ...baseEvent(),
      type: 'feeding',
      startAt: T0,
      endAt: T0 + MINUTE,
      data: { kind: 'bottle', amountMl: 90, milk: 'breast' },
    }
    expect(eventSchema.safeParse(bottle).success).toBe(false)
  })

  describe('breast segments', () => {
    it('accepts contiguous segments that match the event', () => {
      const event = breast(
        [
          { side: 'left', startAt: T0, endAt: T0 + 10 * MINUTE },
          { side: 'right', startAt: T0 + 10 * MINUTE, endAt: T0 + 18 * MINUTE },
        ],
        T0 + 18 * MINUTE,
      )
      expect(eventSchema.safeParse(event).success).toBe(true)
    })

    it('accepts a running feed whose last segment is open', () => {
      const event = breast([{ side: 'left', startAt: T0, endAt: null }], null)
      expect(eventSchema.safeParse(event).success).toBe(true)
    })

    it('rejects gaps, open middle segments and mismatched ends', () => {
      const gap = breast(
        [
          { side: 'left', startAt: T0, endAt: T0 + MINUTE },
          { side: 'right', startAt: T0 + 2 * MINUTE, endAt: T0 + 3 * MINUTE },
        ],
        T0 + 3 * MINUTE,
      )
      const openMiddle = breast(
        [
          { side: 'left', startAt: T0, endAt: null },
          { side: 'right', startAt: T0 + MINUTE, endAt: T0 + 2 * MINUTE },
        ],
        T0 + 2 * MINUTE,
      )
      const stillOpen = breast([{ side: 'left', startAt: T0, endAt: null }], T0 + MINUTE)
      for (const event of [gap, openMiddle, stillOpen]) {
        expect(eventSchema.safeParse(event).success).toBe(false)
      }
    })
  })
})

describe('event helpers', () => {
  const runningSleep = eventSchema.parse(sleep(null))
  const finishedSleep = eventSchema.parse(sleep(T0 + 45 * MINUTE))
  const diaper = eventSchema.parse({
    ...baseEvent(),
    type: 'diaper',
    startAt: T0,
    endAt: null,
    data: { contents: 'dirty' },
  })

  it('knows which events are timed and running', () => {
    expect(isTimed(runningSleep)).toBe(true)
    expect(isTimed(diaper)).toBe(false)
    expect(isRunning(runningSleep)).toBe(true)
    expect(isRunning(finishedSleep)).toBe(false)
    expect(isRunning(diaper)).toBe(false)
  })

  it('derives durations from timestamps', () => {
    expect(eventDurationMs(finishedSleep, T0 + 99 * MINUTE)).toBe(45 * MINUTE)
    expect(eventDurationMs(runningSleep, T0 + 5 * MINUTE)).toBe(5 * MINUTE)
    expect(eventDurationMs(diaper, T0 + 5 * MINUTE)).toBe(0)
  })

  it('totals breastfeeding time per side, including the running segment', () => {
    const totals = breastSideDurations(
      [
        { side: 'left', startAt: T0, endAt: T0 + 10 * MINUTE },
        { side: 'right', startAt: T0 + 10 * MINUTE, endAt: T0 + 15 * MINUTE },
        { side: 'left', startAt: T0 + 15 * MINUTE, endAt: null },
      ],
      T0 + 20 * MINUTE,
    )
    expect(totals).toEqual({ left: 15 * MINUTE, right: 5 * MINUTE })
  })
})

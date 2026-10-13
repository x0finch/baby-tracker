import { eventSchema, isRunning, newId } from '@bobo/shared'
import { describe, expect, it } from 'vitest'

import {
  logBottle,
  logDiaper,
  logSleep,
  logSolids,
  sleepKindFor,
  startBreastFeed,
  startSleep,
  stopEvent,
  suggestedBreastSide,
  switchBreastSide,
} from './records'

const BABY = newId()
const MINUTE = 60_000
const T0 = new Date(2026, 9, 13, 10, 0).getTime()

describe('event builders', () => {
  it('produce schema-valid events', () => {
    const events = [
      startBreastFeed(BABY, 'left', T0),
      logBottle(BABY, T0, 90, 'formula'),
      logSolids(BABY, T0, ' 米糊 '),
      startSleep(BABY, T0),
      logSleep(BABY, T0, T0 + 30 * MINUTE, T0 + 31 * MINUTE),
      logDiaper(BABY, T0, 'wet'),
    ]
    for (const event of events) expect(eventSchema.safeParse(event).error).toBeUndefined()
  })

  it('classifies night sleep by local start time', () => {
    expect(sleepKindFor(new Date(2026, 9, 13, 20, 0).getTime())).toBe('night')
    expect(sleepKindFor(new Date(2026, 9, 13, 3, 0).getTime())).toBe('night')
    expect(sleepKindFor(new Date(2026, 9, 13, 13, 0).getTime())).toBe('nap')
  })
})

describe('breastfeeding timer', () => {
  it('switches sides and stops with consistent segments', () => {
    let feed = startBreastFeed(BABY, 'left', T0)
    feed = switchBreastSide(feed, T0 + 10 * MINUTE)
    feed = switchBreastSide(feed, T0 + 15 * MINUTE)
    expect(isRunning(feed)).toBe(true)
    expect(eventSchema.safeParse(feed).success).toBe(true)

    const stopped = stopEvent(feed, T0 + 20 * MINUTE)
    expect(eventSchema.parse(stopped)).toEqual(stopped)
    expect(stopped.endAt).toBe(T0 + 20 * MINUTE)
    expect(stopped.data.kind === 'breast' && stopped.data.segments.map((s) => s.side)).toEqual([
      'left',
      'right',
      'left',
    ])
  })

  it('never produces negative durations when the clock goes backwards', () => {
    const feed = startBreastFeed(BABY, 'left', T0)
    const stopped = stopEvent(switchBreastSide(feed, T0 - MINUTE), T0 - 2 * MINUTE)
    expect(eventSchema.safeParse(stopped).success).toBe(true)
  })

  it('suggests the opposite of the side the last feed ended on', () => {
    expect(suggestedBreastSide(undefined)).toBe('left')
    const lastEndedRight = stopEvent(
      switchBreastSide(startBreastFeed(BABY, 'left', T0), T0 + 1),
      T0 + 2,
    )
    expect(suggestedBreastSide(lastEndedRight)).toBe('left')
    expect(suggestedBreastSide(stopEvent(startBreastFeed(BABY, 'left', T0), T0 + 1))).toBe('right')
  })
})

describe('stopEvent', () => {
  it('stops a running sleep and leaves finished events alone', () => {
    const stopped = stopEvent(startSleep(BABY, T0), T0 + 45 * MINUTE)
    expect(stopped.endAt).toBe(T0 + 45 * MINUTE)
    expect(stopEvent(stopped, T0 + 99 * MINUTE)).toBe(stopped)
  })
})

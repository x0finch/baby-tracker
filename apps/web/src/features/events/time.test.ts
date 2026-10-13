import { describe, expect, it } from 'vitest'

import { formatClock, fromDateTimeLocal, startOfLocalDay, toDateTimeLocal } from './time'

describe('time helpers', () => {
  it('round-trips datetime-local values in local time', () => {
    const at = new Date(2026, 9, 13, 7, 5).getTime()
    expect(toDateTimeLocal(at)).toBe('2026-10-13T07:05')
    expect(fromDateTimeLocal('2026-10-13T07:05')).toBe(at)
    expect(fromDateTimeLocal('')).toBeNaN()
  })

  it('formats running timers', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(245_000)).toBe('4:05')
    expect(formatClock(3_723_000)).toBe('1:02:03')
    expect(formatClock(-5)).toBe('0:00')
  })

  it('finds the start of the local day', () => {
    expect(startOfLocalDay(new Date(2026, 9, 13, 23, 59).getTime())).toBe(
      new Date(2026, 9, 13).getTime(),
    )
  })
})

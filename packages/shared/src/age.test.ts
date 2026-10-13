import { describe, expect, it } from 'vitest'

import { babyAge, localDateString } from './age'

describe('babyAge', () => {
  it('counts the day of birth as day 0', () => {
    expect(babyAge('2026-10-13', '2026-10-13')).toEqual({ totalDays: 0, months: 0, days: 0 })
  })

  it('counts days in the first month', () => {
    expect(babyAge('2026-10-01', '2026-10-13')).toEqual({ totalDays: 12, months: 0, days: 12 })
  })

  it('counts calendar months and remaining days', () => {
    expect(babyAge('2026-08-10', '2026-10-13')).toEqual({ totalDays: 64, months: 2, days: 3 })
    expect(babyAge('2025-10-13', '2026-10-13')).toMatchObject({ months: 12, days: 0 })
  })

  it('handles month ends', () => {
    expect(babyAge('2026-01-31', '2026-02-28')).toMatchObject({ months: 1, days: 0 })
    expect(babyAge('2026-01-31', '2026-03-01')).toMatchObject({ months: 1, days: 1 })
    expect(babyAge('2026-01-31', '2026-02-27')).toMatchObject({ months: 0, days: 27 })
  })

  it('handles birth dates in the future', () => {
    expect(babyAge('2026-10-20', '2026-10-13')).toEqual({ totalDays: -7, months: 0, days: 0 })
  })
})

describe('localDateString', () => {
  it('formats the local calendar date', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

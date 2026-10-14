import { describe, expect, it } from 'vitest'

import { localDateString, localMidnight, shiftDay, startOfLocalDay } from './date'

describe('date helpers', () => {
  it('formats local dates', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('finds local midnights with an offset', () => {
    expect(localMidnight('2026-10-13')).toBe(new Date(2026, 9, 13).getTime())
    expect(localMidnight('2026-10-13', 1)).toBe(new Date(2026, 9, 14).getTime())
    expect(localMidnight('2026-03-01', -1)).toBe(new Date(2026, 1, 28).getTime())
  })

  it('shifts days across month and year ends', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the start of the local day', () => {
    const at = new Date(2026, 9, 13, 23, 59).getTime()
    expect(startOfLocalDay(at)).toBe(new Date(2026, 9, 13).getTime())
    expect(startOfLocalDay(at, -2)).toBe(new Date(2026, 9, 11).getTime())
  })
})

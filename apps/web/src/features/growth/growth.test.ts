import { describe, expect, it } from 'vitest'

import { ageInMonths, lmsAt, normalCdf, percentileOf, valueAtZ, zScore } from './growth'

describe('WHO growth math', () => {
  it('reproduces the published percentiles', () => {
    // CDC table, boys weight-for-age at 2 months: P50 5.5675, P2.3 (z=-2) 4.31889, P97.7 7.090758.
    const lms = lmsAt('weight', 'male', 2)
    expect(lms).toBeDefined()
    if (!lms) return
    expect(valueAtZ(0, lms)).toBeCloseTo(5.5675, 3)
    expect(valueAtZ(-2, lms)).toBeCloseTo(4.31889, 3)
    expect(valueAtZ(2, lms)).toBeCloseTo(7.090758, 3)
    expect(zScore(7.090758, lms)).toBeCloseTo(2, 3)
  })

  it('handles L = 1 (length and head) and interpolates between months', () => {
    // Girls head circumference: month 0 M 33.8787, month 1 M 36.5463.
    expect(lmsAt('head', 'female', 0.5)?.m).toBeCloseTo((33.8787 + 36.5463) / 2, 4)
    expect(percentileOf('head', 'female', 0, 33.8787)).toBeCloseTo(50, 1)
  })

  it('computes percentiles and refuses ages outside the standard', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.881)).toBeCloseTo(0.97, 3)
    expect(percentileOf('weight', 'male', 30, 13)).toBeUndefined()
    expect(percentileOf('weight', 'male', -1, 3)).toBeUndefined()
  })

  it('measures age in WHO months', () => {
    const at = new Date(2026, 0, 1).getTime() + 30.4375 * 86_400_000
    expect(ageInMonths('2026-01-01', at)).toBeCloseTo(1, 2)
  })
})

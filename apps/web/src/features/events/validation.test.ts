import { newId } from '@bobo/shared'
import { describe, expect, it } from 'vitest'

import { logSleep, startSleep } from './records'
import { overlapsSleep, validateTime } from './validation'

const BABY = newId()
const H = 3_600_000
const T0 = new Date(2026, 9, 13, 12, 0).getTime()

describe('validateTime', () => {
  it('accepts past times and rejects empty or future ones', () => {
    expect(validateTime('2026-10-13T11:00', T0)).toEqual({ at: T0 - H })
    expect(validateTime('', T0)).toHaveProperty('error')
    expect(validateTime('2026-10-13T14:00', T0)).toHaveProperty('error')
  })
})

describe('overlapsSleep', () => {
  const nap = logSleep(BABY, T0 - 3 * H, T0 - 2 * H, T0)

  it('detects overlaps with finished and running sleeps', () => {
    expect(overlapsSleep([nap], T0 - 2.5 * H, T0 - 1.5 * H, T0)).toBe(true)
    expect(overlapsSleep([nap], T0 - 2 * H, T0 - H, T0)).toBe(false)
    expect(overlapsSleep([startSleep(BABY, T0 - H)], T0 - 0.5 * H, T0 - 0.25 * H, T0)).toBe(true)
  })

  it('ignores the event being edited', () => {
    expect(overlapsSleep([nap], T0 - 3 * H, T0 - 2 * H, T0, nap.id)).toBe(false)
  })
})

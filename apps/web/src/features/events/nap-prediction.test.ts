import { describe, expect, it } from 'vitest'

import { ageWakeWindow, predictNextSleep } from './nap-prediction'
import { logSleep, startSleep } from './records'

const BABY = 'baby-1'
const MINUTE = 60_000
// 2026-03-01 is just over four months after the birth date below.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 2, day, hour, minute).getTime()
const BIRTH = '2025-10-25'

describe('ageWakeWindow', () => {
  it('lengthens with age', () => {
    expect(ageWakeWindow(0)).toEqual({ min: 35 * MINUTE, max: 60 * MINUTE })
    expect(ageWakeWindow(4.2)).toEqual({ min: 90 * MINUTE, max: 150 * MINUTE })
    expect(ageWakeWindow(30)).toEqual({ min: 300 * MINUTE, max: 360 * MINUTE })
  })
})

describe('predictNextSleep', () => {
  it('needs a finished sleep and stays quiet while the baby sleeps', () => {
    expect(predictNextSleep([], BIRTH, at(1, 10))).toEqual({ status: 'unknown' })
    expect(predictNextSleep([startSleep(BABY, at(1, 9))], BIRTH, at(1, 10))).toEqual({
      status: 'sleeping',
    })
  })

  it('uses the age-typical window without enough history', () => {
    const events = [logSleep(BABY, at(1, 8), at(1, 9), at(1, 9))]
    // Four months: 90–150 minutes, so centered on 2 hours, give or take 15 minutes.
    expect(predictNextSleep(events, BIRTH, at(1, 9, 30))).toEqual({
      status: 'predicted',
      awakeSince: at(1, 9),
      from: at(1, 10, 45),
      to: at(1, 11, 15),
      personalized: false,
    })
  })

  it('follows the baby’s own recent wake windows', () => {
    // Awake 100 minutes between each nap.
    const events = [
      logSleep(BABY, at(1, 7), at(1, 8), at(1, 8)),
      logSleep(BABY, at(1, 9, 40), at(1, 10, 30), at(1, 10, 30)),
      logSleep(BABY, at(1, 12, 10), at(1, 13), at(1, 13)),
      logSleep(BABY, at(1, 14, 40), at(1, 15), at(1, 15)),
    ]
    const next = predictNextSleep(events, BIRTH, at(1, 15, 10))
    expect(next).toMatchObject({ personalized: true, from: at(1, 16, 25), to: at(1, 16, 55) })
  })

  it('gives up when the last wake-up is long past', () => {
    const events = [logSleep(BABY, at(1, 8), at(1, 9), at(1, 9))]
    expect(predictNextSleep(events, BIRTH, at(1, 18))).toEqual({ status: 'unknown' })
  })
})

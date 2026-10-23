import { describe, expect, it } from 'vitest'

import { ageNorms } from './age-norms'
import { DAY, MINUTE } from './date'
import type { Event } from './event'
import { baseEvent } from './fixtures.test-utils'
import { type NextUpOptions, nextUp } from './next-up'

// UTC stands in for the family's clock, so the times read as written.
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 2, day, hour, minute)
const minuteOfDay = (time: number) => Math.floor((time % DAY) / MINUTE)
// Four months: awake 90–150 minutes, a feed every 180–240, a diaper every 180–240.
const options = (now: number): NextUpOptions => ({ months: 4.2, now, minuteOfDay })

const sleep = (start: number, end: number | null, kind: 'nap' | 'night' = 'nap'): Event => ({
  ...baseEvent(),
  type: 'sleep',
  startAt: start,
  endAt: end,
  data: { kind },
})
const bottle = (start: number, minutes: number | null = 10, amountMl = 120): Event => ({
  ...baseEvent(),
  type: 'feeding',
  startAt: start,
  endAt: minutes === null ? null : start + minutes * MINUTE,
  data: { kind: 'bottle', amountMl, milk: 'formula' },
})
const diaper = (time: number): Event => ({
  ...baseEvent(),
  type: 'diaper',
  startAt: time,
  endAt: null,
  data: { contents: 'wet' },
})

describe('ageNorms', () => {
  it('grows with the baby', () => {
    expect(ageNorms(0).wakeMinutes).toEqual([35, 60])
    expect(ageNorms(4.2).wakeMinutes).toEqual([90, 150])
    expect(ageNorms(3).bottleMlPerFeed).toEqual([120, 180])
    expect(ageNorms(7).solids).toBe('yes')
    expect(ageNorms(30)).toMatchObject({ wakeMinutes: [300, 360], milkMlPerDay: [400, 600] })
  })
})

describe('nextUp', () => {
  it('knows nothing without records, and waits while a feed or sleep runs', () => {
    const empty = nextUp([], options(at(1, 10)))
    expect(empty).toMatchObject({
      feed: { status: 'unknown' },
      sleep: { status: 'unknown' },
      diaper: { status: 'unknown' },
    })
    const running = nextUp([bottle(at(1, 9, 50), null), sleep(at(1, 9), null)], options(at(1, 10)))
    expect(running.feed).toEqual({ status: 'feeding' })
    expect(running.sleep).toEqual({ status: 'sleeping', night: false })
  })

  it('uses the age’s wake window without enough history', () => {
    const next = nextUp([sleep(at(1, 8), at(1, 9))], options(at(1, 9, 30)))
    // Centered on 2 hours, give or take 15 minutes.
    expect(next.sleep).toEqual({
      status: 'predicted',
      since: at(1, 9),
      bedtime: false,
      from: at(1, 10, 45),
      to: at(1, 11, 15),
      personalized: false,
    })
  })

  it('follows the baby’s own wake windows, a short stir not counting as waking', () => {
    // Awake 100 minutes between naps; the 10:30 nap had a 5-minute stir in it.
    const events = [
      sleep(at(1, 7), at(1, 8)),
      sleep(at(1, 9, 40), at(1, 10)),
      sleep(at(1, 10, 5), at(1, 10, 30)),
      sleep(at(1, 12, 10), at(1, 13)),
      sleep(at(1, 14, 40), at(1, 15)),
    ]
    expect(nextUp(events, options(at(1, 15, 10))).sleep).toMatchObject({
      personalized: true,
      from: at(1, 16, 25),
      to: at(1, 16, 55),
    })
  })

  it('gives up when the last one is long past, probably not logged', () => {
    const next = nextUp([sleep(at(1, 8), at(1, 9)), bottle(at(1, 8))], options(at(1, 18)))
    expect(next.sleep).toEqual({ status: 'unknown' })
    expect(next.feed).toEqual({ status: 'unknown' })
  })

  it('counts a top-up as part of the feed before it', () => {
    // A little at 9:00, more at 9:30: one feed from 9:00, the next about 3.5 hours later.
    const events = [bottle(at(1, 9), 10, 40), bottle(at(1, 9, 30), 15, 100)]
    expect(nextUp(events, options(at(1, 10))).feed).toEqual({
      status: 'predicted',
      since: at(1, 9),
      from: at(1, 12, 15),
      to: at(1, 12, 45),
      personalized: false,
    })
  })

  it('reads the feeding rhythm from the week, not the last gap', () => {
    // Every 3 hours for three days; today's quick second feed doesn't shorten it.
    const events = [1, 2, 3].flatMap((day) => [8, 11, 14, 17].map((hour) => bottle(at(day, hour))))
    events.push(bottle(at(4, 8)), bottle(at(4, 9, 30)))
    const next = nextUp(events, options(at(4, 10)))
    expect(next.feed).toMatchObject({
      personalized: true,
      since: at(4, 9, 30),
      from: at(4, 12, 15),
      to: at(4, 12, 45),
    })
    expect(next.feedEvery).toBe(180 * MINUTE)
  })

  it('suggests diaper changes from the day’s rhythm', () => {
    const events = [diaper(at(1, 8)), diaper(at(1, 11)), diaper(at(1, 14)), diaper(at(1, 17))]
    expect(nextUp(events, options(at(1, 17, 30))).diaper).toMatchObject({
      personalized: true,
      from: at(1, 19, 45),
      to: at(1, 20, 15),
    })
  })

  describe('at night', () => {
    // Three nights from 20:30 to 6:30, fed at 19:00, 23:00 and 3:00.
    const nights = [1, 2, 3].flatMap((day) => [
      sleep(at(day, 20, 30), at(day + 1, 6, 30), 'night'),
      bottle(at(day, 19)),
      bottle(at(day, 23)),
      bottle(at(day + 1, 3)),
    ])

    it('suggests only feeds, at the night’s own pace, until morning', () => {
      const events = [
        ...nights,
        bottle(at(4, 19)),
        sleep(at(4, 20, 30), null, 'night'),
        bottle(at(4, 23)),
      ]
      const next = nextUp(events, options(at(5, 1)))
      expect(next.night).toBe(true)
      expect(next.sleep).toEqual({ status: 'sleeping', night: true })
      expect(next.diaper).toEqual({ status: 'unknown' })
      expect(next.feed).toMatchObject({ personalized: true, since: at(4, 23) })
      expect(next.plan).toEqual([{ kind: 'feed', at: at(5, 3) }])
    })

    it('suggests bedtime at the baby’s usual time once it comes before another nap', () => {
      const events = [...nights, sleep(at(4, 17), at(4, 18, 30))]
      expect(nextUp(events, options(at(4, 19))).sleep).toEqual({
        status: 'predicted',
        since: at(4, 18, 30),
        bedtime: true,
        from: at(4, 20, 15),
        to: at(4, 20, 45),
        personalized: true,
      })
    })
  })

  describe('when sleep goes unlogged', () => {
    it('still keeps to the night by the clock: feeds only, until morning', () => {
      const events = [bottle(at(1, 23)), diaper(at(1, 23))]
      const next = nextUp(events, options(at(2, 2)))
      expect(next.night).toBe(true)
      expect(next.diaper).toEqual({ status: 'unknown' })
      expect(next.plan.every((item) => item.kind === 'feed')).toBe(true)
      expect(next.plan.at(-1)?.at).toBeLessThan(at(2, 7))
    })

    it('suggests bedtime, late, while the baby is still up', () => {
      const next = nextUp([sleep(at(1, 16), at(1, 17))], options(at(1, 21)))
      expect(next.sleep).toMatchObject({
        status: 'predicted',
        bedtime: true,
        from: at(1, 19, 45),
        to: at(1, 20, 15),
      })
      // Once the night's sleep is logged, nothing more until morning.
      const asleep = nextUp([sleep(at(1, 20, 30), at(1, 23), 'night')], options(at(1, 23, 30)))
      expect(asleep.sleep).toEqual({ status: 'unknown' })
    })

    it('is day while a nap runs late', () => {
      expect(nextUp([sleep(at(1, 19, 30), null)], options(at(1, 20, 30))).night).toBe(false)
    })
  })

  it('lays out the rest of the day: feeds and naps in turn, then bedtime', () => {
    const events = [sleep(at(1, 7), at(1, 8)), bottle(at(1, 8))]
    const { plan } = nextUp(events, options(at(1, 8, 30)))
    expect(plan.map((item) => item.kind)).toEqual([
      'nap',
      'feed',
      'nap',
      'feed',
      'nap',
      'feed',
      'nap',
      'bedtime',
    ])
    expect(plan[0]).toEqual({ kind: 'nap', at: at(1, 10) })
    expect(plan[1]).toEqual({ kind: 'feed', at: at(1, 11, 30) })
    expect(plan.at(-1)).toEqual({ kind: 'bedtime', at: at(1, 20) })
  })
})

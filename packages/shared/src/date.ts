/** Local calendar helpers. Days are "YYYY-MM-DD" in the device's time zone. */

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

/** Splits a "YYYY-MM-DD" day into its numeric parts (month is 1-based). */
export function parseDay(day: string): { year: number; month: number; day: number } {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return { year, month, day: date }
}

/** Local calendar date ("YYYY-MM-DD") of an instant on this device. */
export function localDateString(at: Date | number = Date.now()): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight of `day`, moved by `offsetDays` whole days (DST-safe). */
export function localMidnight(day: string, offsetDays = 0): number {
  const { year, month, day: date } = parseDay(day)
  return new Date(year, month - 1, date + offsetDays).getTime()
}

/** The day `delta` days after `day`. */
export const shiftDay = (day: string, delta: number): string =>
  localDateString(localMidnight(day, delta))

/** Local midnight of the day containing `at`, moved by `offsetDays` whole days (DST-safe). */
export function startOfLocalDay(at: number, offsetDays = 0): number {
  const d = new Date(at)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime()
}

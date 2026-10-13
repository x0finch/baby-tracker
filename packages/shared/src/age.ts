/** Calendar age of a baby, counted in whole months then remaining days. */
export interface BabyAge {
  totalDays: number
  months: number
  days: number
}

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return { year, month, day }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Age on `today` (both "YYYY-MM-DD" in the family's local calendar). Day of birth is
 * day 0. Months follow the calendar: born Jan 31 -> one month old on Feb 28/29.
 */
export function babyAge(birthDate: string, today: string): BabyAge {
  const birth = parseDate(birthDate)
  const now = parseDate(today)
  const totalDays = Math.round(
    (Date.UTC(now.year, now.month - 1, now.day) -
      Date.UTC(birth.year, birth.month - 1, birth.day)) /
      86_400_000,
  )
  if (totalDays < 0) return { totalDays, months: 0, days: 0 }

  let months = (now.year - birth.year) * 12 + (now.month - birth.month)
  // Clamp the birth day to the length of the current month (Jan 31 -> Feb 28).
  const anchorDay = Math.min(birth.day, daysInMonth(now.year, now.month))
  if (now.day < anchorDay) months -= 1

  const anchorYear = birth.year + Math.floor((birth.month - 1 + months) / 12)
  const anchorMonth = ((birth.month - 1 + months) % 12) + 1
  const anchor = Date.UTC(
    anchorYear,
    anchorMonth - 1,
    Math.min(birth.day, daysInMonth(anchorYear, anchorMonth)),
  )
  const days = Math.round((Date.UTC(now.year, now.month - 1, now.day) - anchor) / 86_400_000)
  return { totalDays, months, days }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date ("YYYY-MM-DD") of an instant on this device. */
export function localDateString(at: Date | number = Date.now()): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

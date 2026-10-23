import { formatDate, formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'

const pad = (n: number) => String(n).padStart(2, '0')

/** Value for <input type="datetime-local"> in the device time zone. */
export function toDateTimeLocal(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parses a datetime-local value as device-local time; NaN when empty or invalid. */
export function fromDateTimeLocal(value: string): number {
  return value ? new Date(value).getTime() : Number.NaN
}

/** Running timer display: "4:05", "12:34" or "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** "今天 09:31", "昨天 22:10" or "10月21日 08:00": every start, end and time shown the same way. */
export function formatDayTime(at: number, now: number): string {
  const time = formatTime(at)
  const day = (offset: number) => {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + offset)
    return date.getTime()
  }
  if (at >= day(0) && at < day(1)) return m.timeToday({ time })
  if (at >= day(-1) && at < day(0)) return m.timeYesterday({ time })
  return m.timeOnDay({ day: formatDate(at, { month: 'long', day: 'numeric' }), time })
}

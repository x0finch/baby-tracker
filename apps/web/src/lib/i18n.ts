import { getLocale, locales, setLocale } from '../paraglide/runtime.js'

export { getLocale, locales, setLocale }
export type Locale = (typeof locales)[number]

/** Locale-aware formatting. Always go through these helpers instead of formatting by hand. */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string = getLocale(),
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatDate(
  date: Date | number,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'short' },
  locale: string = getLocale(),
): string {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatTime(date: Date | number, locale: string = getLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** Name of a locale in its own language, e.g. "中文（中国）" for zh-CN. */
export function localeDisplayName(locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale
}

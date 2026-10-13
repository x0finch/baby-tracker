import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber, formatTime, getLocale, locales, localeDisplayName } from './i18n'

describe('i18n runtime', () => {
  it('uses zh-CN as the base locale', () => {
    expect(locales).toContain('zh-CN')
    expect(getLocale()).toBe('zh-CN')
  })
})

describe('formatters', () => {
  const date = new Date(2026, 9, 13, 7, 5)

  it('formats numbers per locale', () => {
    expect(formatNumber(1234.5, undefined, 'zh-CN')).toBe('1,234.5')
    expect(formatNumber(1234.5, undefined, 'de-DE')).toBe('1.234,5')
  })

  it('formats times as 24-hour clock', () => {
    expect(formatTime(date, 'zh-CN')).toBe('07:05')
    expect(formatTime(date, 'en-US')).toBe('07:05')
  })

  it('formats dates per locale', () => {
    expect(formatDate(date, undefined, 'zh-CN')).toBe('10月13日周二')
    expect(formatDate(date, undefined, 'en-US')).toBe('Tue, October 13')
  })

  it('names locales in their own language', () => {
    expect(localeDisplayName('zh-CN')).toBe('中文（中国）')
    expect(localeDisplayName('en')).toBe('English')
  })
})

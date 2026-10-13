import { describe, expect, it } from 'vitest'

import { THEME_COLORS, parseThemePreference, resolveTheme, themeInitScript } from './theme'

describe('parseThemePreference', () => {
  it('accepts explicit themes', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
  })

  it('falls back to system for anything else', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('blue')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the system preference by default', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('lets an explicit preference override the system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

function runInitScript(stored: string | null, systemDark: boolean) {
  const meta = { content: '', setAttribute: (_: string, value: string) => (meta.content = value) }
  const documentStub = {
    documentElement: { dataset: {} as Record<string, string> },
    querySelector: () => meta,
  }
  // The script is injected as raw text into the document head, so run it the same way.
  // oxlint-disable-next-line typescript/no-implied-eval
  const run = new Function('localStorage', 'matchMedia', 'document', themeInitScript)
  run({ getItem: () => stored }, () => ({ matches: systemDark }), documentStub)
  return { theme: documentStub.documentElement.dataset.theme, color: meta.content }
}

describe('themeInitScript', () => {
  it('applies the system theme when nothing is stored', () => {
    expect(runInitScript(null, true)).toEqual({ theme: 'dark', color: THEME_COLORS.dark })
    expect(runInitScript(null, false)).toEqual({ theme: 'light', color: THEME_COLORS.light })
  })

  it('applies a stored preference over the system theme', () => {
    expect(runInitScript('light', true)).toEqual({ theme: 'light', color: THEME_COLORS.light })
    expect(runInitScript('dark', false)).toEqual({ theme: 'dark', color: THEME_COLORS.dark })
  })
})

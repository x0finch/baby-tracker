import { useCallback, useState } from 'react'

import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ThemePreference,
  parseThemePreference,
  resolveTheme,
} from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference, matchMedia(DARK_QUERY).matches)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

const onSystemThemeChange = () => applyTheme(readStoredPreference())

/**
 * Follows the system color scheme on every page while the preference is "system".
 * Returns the unsubscribe function; mount once at the app root.
 */
export function watchSystemTheme(): () => void {
  const query = matchMedia(DARK_QUERY)
  query.addEventListener('change', onSystemThemeChange)
  return () => query.removeEventListener('change', onSystemThemeChange)
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session.
    }
    applyTheme(next)
    setPreferenceState(next)
  }, [])

  return { preference, setPreference }
}

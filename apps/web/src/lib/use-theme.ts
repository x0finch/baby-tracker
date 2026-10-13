import { useCallback, useEffect, useState } from 'react'

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

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return undefined
    const query = matchMedia(DARK_QUERY)
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this session.
    }
    setPreferenceState(next)
  }, [])

  return { preference, setPreference }
}

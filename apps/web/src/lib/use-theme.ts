import { createStoredValue, useStore } from './store'
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ThemePreference,
  parseThemePreference,
  resolveTheme,
} from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

// "system" is the default and isn't stored, matching the inline init script.
const themePreference = createStoredValue<ThemePreference>(
  THEME_STORAGE_KEY,
  {
    parse: parseThemePreference,
    serialize: (preference) => (preference === 'system' ? null : preference),
  },
  'system',
)

function applyTheme() {
  const theme = resolveTheme(themePreference.get(), matchMedia(DARK_QUERY).matches)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

/**
 * Applies the theme whenever the preference (also from another tab) or, for "system", the
 * system color scheme changes. Returns the unsubscribe function; mount once at the app root.
 */
export function watchTheme(): () => void {
  const query = matchMedia(DARK_QUERY)
  query.addEventListener('change', applyTheme)
  const unsubscribe = themePreference.subscribe(applyTheme)
  return () => {
    query.removeEventListener('change', applyTheme)
    unsubscribe()
  }
}

export function useTheme() {
  return { preference: useStore(themePreference), setPreference: themePreference.set }
}

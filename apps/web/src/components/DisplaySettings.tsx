import { type Locale, getLocale, localeDisplayName, locales, setLocale } from '../lib/i18n'
import type { ThemePreference } from '../lib/theme'
import { unitLabel, useUnits } from '../lib/units'
import { useTheme } from '../lib/use-theme'
import { m } from '../paraglide/messages.js'
import { Card } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'

const themeLabel: Record<ThemePreference, () => string> = {
  system: m.themeSystem,
  light: m.themeLight,
  dark: m.themeDark,
}
const themes = ['system', 'light', 'dark'] as const

/** "跟随系统 · ml · kg": the theme and the most used units, for the settings index. */
export function useDisplaySummary() {
  const { preference } = useTheme()
  const units = useUnits()
  return [themeLabel[preference](), unitLabel('volume', units), unitLabel('weight', units)].join(
    ' · ',
  )
}

export function ThemeCard() {
  const { preference, setPreference } = useTheme()
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.settingsTheme()}</h2>
      <SegmentedControl
        label={m.settingsTheme()}
        options={themes.map((value) => ({ value, label: themeLabel[value]() }))}
        value={preference}
        onChange={setPreference}
      />
    </Card>
  )
}

/** Hidden until a second locale ships; switching reloads the app in that locale. */
export function LanguageCard() {
  if (locales.length < 2) return null
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.settingsLanguage()}</h2>
      <SegmentedControl<Locale>
        label={m.settingsLanguage()}
        options={locales.map((locale) => ({ value: locale, label: localeDisplayName(locale) }))}
        value={getLocale()}
        onChange={(locale) => void setLocale(locale)}
      />
    </Card>
  )
}

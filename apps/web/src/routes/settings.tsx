import { Link, createFileRoute } from '@tanstack/react-router'

import { InstallCard } from '../components/InstallCard'
import { PageHeader } from '../components/PageHeader'
import { StorageStatus } from '../components/StorageStatus'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { UnitsCard } from '../components/UnitsCard'
import { BabyList } from '../features/babies/BabyList'
import { ExportCard } from '../features/export/ExportCard'
import { FamilySection } from '../features/family/FamilyCard'
import { type Locale, getLocale, localeDisplayName, locales, setLocale } from '../lib/i18n'
import type { ThemePreference } from '../lib/theme'
import { useTheme } from '../lib/use-theme'
import { m } from '../paraglide/messages.js'
import { AccountCard } from '../sync/AccountCard'
import { RemindersCard } from '../sync/RemindersCard'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: m.themeSystem() },
    { value: 'light', label: m.themeLight() },
    { value: 'dark', label: m.themeDark() },
  ]
  const localeOptions = locales.map((locale) => ({
    value: locale,
    label: localeDisplayName(locale),
  }))

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={m.settingsTitle()} />
      <AccountCard />
      <FamilySection />
      <RemindersCard />
      <Card className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.settingsTheme()}</h2>
        <SegmentedControl
          label={m.settingsTheme()}
          options={themeOptions}
          value={preference}
          onChange={setPreference}
        />
      </Card>
      <UnitsCard />
      {/* Hidden until a second locale ships; switching reloads the app in that locale. */}
      {localeOptions.length > 1 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-title font-extrabold">{m.settingsLanguage()}</h2>
          <SegmentedControl<Locale>
            label={m.settingsLanguage()}
            options={localeOptions}
            value={getLocale()}
            onChange={(locale) => void setLocale(locale)}
          />
        </Card>
      )}
      <Card className="flex flex-col gap-2">
        <h2 className="text-title font-extrabold">{m.settingsBabies()}</h2>
        <BabyList />
      </Card>
      <ExportCard />
      <InstallCard />
      <Card className="flex flex-col gap-2">
        <h2 className="text-title font-extrabold">{m.storageTitle()}</h2>
        <StorageStatus />
      </Card>
      {import.meta.env.DEV && (
        <Link to="/ui" className="font-bold text-diaper-text underline">
          {m.settingsUiPreview()}
        </Link>
      )}
    </section>
  )
}

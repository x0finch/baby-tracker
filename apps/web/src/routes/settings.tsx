import { Link, createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import type { ThemePreference } from '../lib/theme'
import { useTheme } from '../lib/use-theme'
import { messages } from '../messages'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const themeOptions = [
  { value: 'system', label: messages.themeSystem },
  { value: 'light', label: messages.themeLight },
  { value: 'dark', label: messages.themeDark },
] as const satisfies readonly { value: ThemePreference; label: string }[]

function SettingsPage() {
  const { preference, setPreference } = useTheme()

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={messages.settingsTitle} />
      <Card className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{messages.settingsTheme}</h2>
        <SegmentedControl
          label={messages.settingsTheme}
          options={themeOptions}
          value={preference}
          onChange={setPreference}
        />
      </Card>
      <Card>
        <p className="text-fg-muted">{messages.settingsBabies}</p>
      </Card>
      {import.meta.env.DEV && (
        <Link to="/ui" className="font-bold text-diaper-text underline">
          {messages.settingsUiPreview}
        </Link>
      )}
    </section>
  )
}

import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { ExportCard } from '../features/export/ExportCard'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/export')({
  component: () => (
    <SettingsPage title={m.exportTitle()}>
      <ExportCard />
    </SettingsPage>
  ),
})

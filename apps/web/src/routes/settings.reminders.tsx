import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { RemindersCard } from '../features/reminders/RemindersCard'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/reminders')({
  component: () => (
    <SettingsPage title={m.remindersTitle()}>
      <RemindersCard />
    </SettingsPage>
  ),
})

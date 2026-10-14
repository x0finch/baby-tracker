import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { AccountCard } from '../features/account/AccountCard'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/account')({
  component: () => (
    <SettingsPage title={m.accountTitle()}>
      <AccountCard />
    </SettingsPage>
  ),
})

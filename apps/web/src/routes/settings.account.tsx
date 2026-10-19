import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { AccountCard } from '../features/account/AccountCard'
import { accountQueries } from '../features/account/queries'
import { m } from '../paraglide/messages.js'
import { isSignedIn } from '../sync/local'

export const Route = createFileRoute('/settings/account')({
  loader: async ({ context: { queryClient } }) => {
    // Started, not awaited: the page opens at once and finds the data on its way.
    if (await isSignedIn()) {
      void queryClient.prefetchQuery(accountQueries.me())
      void queryClient.prefetchQuery(accountQueries.passkeys())
    }
  },
  component: () => (
    <SettingsPage title={m.accountTitle()}>
      <AccountCard />
    </SettingsPage>
  ),
})

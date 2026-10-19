import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { MyAi } from '../features/ai/MyAi'
import { aiQueries } from '../features/ai/queries'
import { m } from '../paraglide/messages.js'
import { isSignedIn } from '../sync/local'

export const Route = createFileRoute('/settings/ai')({
  loader: async ({ context: { queryClient } }) => {
    // Started, not awaited: the page opens at once and finds the data on its way.
    if (await isSignedIn()) void queryClient.prefetchQuery(aiQueries.mine())
  },
  component: () => (
    <SettingsPage title={m.aiMineTitle()}>
      <MyAi />
    </SettingsPage>
  ),
})

import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { voiceQueries } from '../features/voice/queries'
import { VoiceCard } from '../features/voice/VoiceCard'
import { m } from '../paraglide/messages.js'
import { isSignedIn } from '../sync/local'

export const Route = createFileRoute('/settings/voice')({
  loader: async ({ context: { queryClient } }) => {
    // Started, not awaited: the page opens at once and finds the data on its way.
    if (await isSignedIn()) void queryClient.prefetchQuery(voiceQueries.settings())
  },
  component: () => (
    <SettingsPage title={m.voiceTitle()}>
      <VoiceCard />
    </SettingsPage>
  ),
})

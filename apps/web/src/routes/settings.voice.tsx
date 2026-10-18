import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { VoiceCard } from '../features/voice/VoiceCard'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/voice')({
  component: () => (
    <SettingsPage title={m.voiceTitle()}>
      <VoiceCard />
    </SettingsPage>
  ),
})

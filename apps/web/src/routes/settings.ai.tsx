import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { MyAi } from '../features/ai/MyAi'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/ai')({
  component: () => (
    <SettingsPage title={m.aiMineTitle()}>
      <MyAi />
    </SettingsPage>
  ),
})

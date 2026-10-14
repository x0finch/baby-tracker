import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../components/SettingsLayout'
import { Card } from '../components/ui/Card'
import { BabyList } from '../features/babies/BabyList'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/babies')({
  component: () => (
    <SettingsPage title={m.settingsBabies()}>
      <Card>
        <BabyList />
      </Card>
    </SettingsPage>
  ),
})

import { createFileRoute } from '@tanstack/react-router'

import { VersionCard } from '../components/AppVersion'
import { InstallCard } from '../components/InstallCard'
import { SettingsPage } from '../components/SettingsLayout'
import { StorageStatus } from '../components/StorageStatus'
import { Card, CardTitle } from '../components/ui/Card'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/settings/about')({
  component: () => (
    <SettingsPage title={m.settingsAbout()}>
      <InstallCard />
      <Card className="flex flex-col gap-2">
        <CardTitle>{m.storageTitle()}</CardTitle>
        <StorageStatus />
      </Card>
      <VersionCard />
    </SettingsPage>
  ),
})

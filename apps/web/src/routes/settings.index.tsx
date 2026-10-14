import { Link, createFileRoute } from '@tanstack/react-router'

import { useDisplaySummary } from '../components/DisplaySettings'
import { PageHeader } from '../components/PageHeader'
import { SettingsGroup, SettingsRow } from '../components/SettingsLayout'
import { useLocalStore } from '../db'
import { useSyncStatusText } from '../features/account/AccountCard'
import { useBabies } from '../features/babies/use-babies'
import { FamilyList } from '../features/family/FamilyList'
import { usePushState } from '../features/reminders/RemindersCard'
import { m } from '../paraglide/messages.js'
import { getAccount } from '../sync/local'
import { useAccess } from '../sync/use-access'

export const Route = createFileRoute('/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const store = useLocalStore()
  const { userId } = useAccess()
  const account = getAccount(store)
  const syncStatus = useSyncStatusText()
  const { active, archived } = useBabies()
  const push = usePushState()

  const accountSummary = userId
    ? [account?.userName, syncStatus].filter(Boolean).join(' · ')
    : m.settingsSignedOut()
  const babyNames =
    active.length <= 3
      ? active.map((baby) => baby.name).join('、')
      : m.familyBabiesCount({ count: active.length })
  const babiesSummary = [
    babyNames,
    archived.length > 0 && m.settingsArchivedCount({ count: archived.length }),
  ]
    .filter(Boolean)
    .join(' · ')
  const remindersSummary = !userId
    ? m.settingsNeedsSignIn()
    : push === 'on'
      ? m.pushOn()
      : m.pushOff()

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={m.settingsTitle()} />
      <SettingsGroup>
        <SettingsRow to="/settings/account" title={m.accountTitle()} summary={accountSummary} />
      </SettingsGroup>
      <FamilyList />
      <SettingsGroup title={m.settingsGroupBabies()}>
        <SettingsRow to="/settings/babies" title={m.settingsBabies()} summary={babiesSummary} />
        <SettingsRow
          to="/settings/reminders"
          title={m.remindersTitle()}
          summary={remindersSummary}
        />
        <SettingsRow
          to="/settings/export"
          title={m.exportTitle()}
          summary={m.settingsExportSummary()}
        />
      </SettingsGroup>
      <SettingsGroup title={m.settingsGroupApp()}>
        <SettingsRow
          to="/settings/display"
          title={m.settingsDisplay()}
          summary={useDisplaySummary()}
        />
        <SettingsRow
          to="/settings/about"
          title={m.settingsAbout()}
          summary={m.settingsVersion({ build: import.meta.env.APP_BUILD })}
        />
      </SettingsGroup>
      {import.meta.env.DEV && (
        <Link to="/ui" className="font-bold text-diaper-text underline">
          {m.settingsUiPreview()}
        </Link>
      )}
    </section>
  )
}

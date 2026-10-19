import { Link, createFileRoute } from '@tanstack/react-router'

import { useVersionSummary } from '../components/AppVersion'
import { useDisplaySummary } from '../components/DisplaySettings'
import { PageHeader } from '../components/PageHeader'
import { SettingsGroup, SettingsRow } from '../components/SettingsLayout'
import { useSyncStatusText } from '../features/account/AccountCard'
import { useAiSummary } from '../features/ai/MyAi'
import { useBabies } from '../features/babies/use-babies'
import { FamilyList } from '../features/family/FamilyList'
import { usePushState } from '../features/reminders/RemindersCard'
import { useVoiceSummary } from '../features/voice/VoiceCard'
import { m } from '../paraglide/messages.js'
import { useAccess, useAccount } from '../sync/use-access'

export const Route = createFileRoute('/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { userId } = useAccess()
  const account = useAccount()
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
        <SettingsRow
          link={{ to: '/settings/account' }}
          title={m.accountTitle()}
          summary={accountSummary}
        />
      </SettingsGroup>
      <FamilyList />
      <SettingsGroup title={m.settingsGroupBabies()}>
        <SettingsRow
          link={{ to: '/settings/babies' }}
          title={m.settingsBabies()}
          summary={babiesSummary}
        />
        <SettingsRow
          link={{ to: '/settings/reminders' }}
          title={m.reminderTitle()}
          summary={remindersSummary}
        />
        <SettingsRow
          link={{ to: '/settings/export' }}
          title={m.exportTitle()}
          summary={m.settingsExportSummary()}
        />
      </SettingsGroup>
      <SettingsGroup title={m.settingsGroupAi()}>
        <SettingsRow
          link={{ to: '/settings/ai' }}
          title={m.aiMineTitle()}
          summary={useAiSummary()}
        />
        <SettingsRow
          link={{ to: '/settings/voice' }}
          title={m.voiceTitle()}
          summary={useVoiceSummary()}
        />
      </SettingsGroup>
      <SettingsGroup title={m.settingsGroupApp()}>
        <SettingsRow
          link={{ to: '/settings/display' }}
          title={m.settingsDisplay()}
          summary={useDisplaySummary()}
        />
        <SettingsRow
          link={{ to: '/settings/about' }}
          title={m.settingsAbout()}
          summary={useVersionSummary()}
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

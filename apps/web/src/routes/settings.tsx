import { createFileRoute } from '@tanstack/react-router'

import { messages } from '../messages'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <section className="page">
      <h1 className="page-title">{messages.settingsTitle}</h1>
      <p className="page-empty">{messages.settingsBabies}</p>
    </section>
  )
}

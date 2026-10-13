import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/PageHeader'
import { RequireBaby } from '../features/babies/RequireBaby'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/')({
  component: TodayPage,
})

function TodayPage() {
  return (
    <RequireBaby>
      <PageHeader title={m.todayTitle()} />
      <p className="text-fg-muted">{m.todayEmpty()}</p>
    </RequireBaby>
  )
}

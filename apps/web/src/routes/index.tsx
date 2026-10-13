import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/PageHeader'
import { messages } from '../messages'

export const Route = createFileRoute('/')({
  component: TodayPage,
})

function TodayPage() {
  return (
    <section>
      <PageHeader title={messages.todayTitle} />
      <p className="text-fg-muted">{messages.todayEmpty}</p>
    </section>
  )
}

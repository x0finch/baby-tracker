import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/PageHeader'
import { messages } from '../messages'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

function StatsPage() {
  return (
    <section>
      <PageHeader title={messages.statsTitle} />
      <p className="text-fg-muted">{messages.statsEmpty}</p>
    </section>
  )
}

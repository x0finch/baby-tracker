import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/PageHeader'
import { m } from '../paraglide/messages.js'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

function StatsPage() {
  return (
    <section>
      <PageHeader title={m.statsTitle()} />
      <p className="text-fg-muted">{m.statsEmpty()}</p>
    </section>
  )
}

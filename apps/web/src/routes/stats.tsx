import { createFileRoute } from '@tanstack/react-router'

import { messages } from '../messages'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

function StatsPage() {
  return (
    <section className="page">
      <h1 className="page-title">{messages.statsTitle}</h1>
      <p className="page-empty">{messages.statsEmpty}</p>
    </section>
  )
}

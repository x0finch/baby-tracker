import { createFileRoute } from '@tanstack/react-router'

import { messages } from '../messages'

export const Route = createFileRoute('/')({
  component: TodayPage,
})

function TodayPage() {
  return (
    <section className="page">
      <h1 className="page-title">{messages.todayTitle}</h1>
      <p className="page-empty">{messages.todayEmpty}</p>
    </section>
  )
}

import { type ErrorComponentProps, useNavigate } from '@tanstack/react-router'

import { m } from '../paraglide/messages.js'
import { PageHeader } from './PageHeader'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

// The router's fallbacks: an installed app has no address bar to get out of a bad page.

function HomeButton() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" block onClick={() => void navigate({ to: '/' })}>
      {m.routeBackHome()}
    </Button>
  )
}

/** A link to a page that doesn't exist. */
export function NotFoundPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={m.routeNotFoundTitle()} />
      <Card className="flex flex-col gap-3">
        <p className="m-0 text-fg-muted">{m.routeNotFoundBody()}</p>
        <HomeButton />
      </Card>
    </section>
  )
}

/** A page that failed to load or render. */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  console.error(error)
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={m.routeErrorTitle()} />
      <Card className="flex flex-col gap-3">
        <p className="m-0 text-fg-muted">{m.routeErrorBody()}</p>
        <Button size="lg" block onClick={reset}>
          {m.routeRetry()}
        </Button>
        <HomeButton />
      </Card>
    </section>
  )
}

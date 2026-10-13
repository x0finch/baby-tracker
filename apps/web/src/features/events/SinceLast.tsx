import { type Event, isRunning } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'
import { lastActivityAt } from './summary'
import { useNow } from './use-events'

/** "Time since last" hints, the main question at 3am: when did the baby last eat? */
export function SinceLast({ events }: { events: readonly Event[] }) {
  const now = useNow(30_000)
  const sleeping = events.some((event) => event.type === 'sleep' && isRunning(event))
  const items = [
    { label: m.sinceFeeding(), at: lastActivityAt(events, 'feeding', now), dot: 'bg-feeding' },
    {
      label: m.sinceSleep(),
      at: sleeping ? undefined : lastActivityAt(events, 'sleep', now),
      dot: 'bg-sleep',
      override: sleeping ? m.sleepingNow() : undefined,
    },
    { label: m.sinceDiaper(), at: lastActivityAt(events, 'diaper', now), dot: 'bg-diaper' },
  ]

  return (
    <dl className="m-0 grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2">
          <dt className="flex items-center gap-1.5 text-caption text-fg-muted">
            <span aria-hidden className={`size-2 rounded-full ${item.dot}`} />
            {item.label}
          </dt>
          <dd className="m-0 font-extrabold">
            {item.override ??
              (item.at === undefined
                ? m.neverLogged()
                : m.ago({ duration: durationLabel(now - item.at) }))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

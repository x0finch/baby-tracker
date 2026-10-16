import { type Event, isRunning } from '@bobo/shared'

import { RollingText } from '../../components/ui/RollingText'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'
import { EventIcon, type IconKind } from './EventIcon'
import { lastActivityAt } from './summary'

/** "Time since last" hints, the main question at 3am: when did the baby last eat? */
export function SinceLast({ events }: { events: readonly Event[] }) {
  const now = useNow(30_000)
  const sleeping = events.some((event) => event.type === 'sleep' && isRunning(event))
  const items: { label: string; at: number | undefined; icon: IconKind; override?: string }[] = [
    { label: m.sinceFeeding(), at: lastActivityAt(events, 'feeding', now), icon: 'bottle' },
    {
      label: m.sinceSleep(),
      at: sleeping ? undefined : lastActivityAt(events, 'sleep', now),
      icon: 'sleep',
      override: sleeping ? m.sinceSleepingNow() : undefined,
    },
    { label: m.sinceDiaper(), at: lastActivityAt(events, 'diaper', now), icon: 'diaper' },
  ]

  return (
    <dl className="m-0 grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2">
          <dt className="flex items-center gap-1 whitespace-nowrap text-caption text-fg-muted">
            <EventIcon kind={item.icon} className="size-4" />
            {item.label}
          </dt>
          <dd className="m-0 font-extrabold">
            <RollingText>
              {item.override ??
                (item.at === undefined
                  ? m.sinceNever()
                  : m.timeAgo({ duration: durationLabel(now - item.at) }))}
            </RollingText>
          </dd>
        </div>
      ))}
    </dl>
  )
}

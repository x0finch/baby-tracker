import type { Event } from '@bobo/shared'
import { clsx } from 'clsx'

import { formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { categoryDot } from './category'
import { describeEvent } from './describe'
import { startOfLocalDay } from './time'
import { useNow } from './use-events'

/** Today's events for the selected baby, newest first. */
export function TodayList({ events }: { events: readonly Event[] }) {
  const now = useNow(60_000)
  const today = events.filter((event) => event.startAt >= startOfLocalDay(now))

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-extrabold">{m.todaySummaryTitle()}</h2>
      {today.length === 0 ? (
        <p className="text-fg-muted">{m.todayEmpty()}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {today.map((event) => {
            const { title, detail } = describeEvent(event, now)
            return (
              <li key={event.id} className="flex items-center gap-3 border-b-2 border-border py-3">
                <span
                  aria-hidden
                  className={clsx('size-3 rounded-full', categoryDot[event.type])}
                />
                <span className="w-12 text-fg-muted tabular-nums">{formatTime(event.startAt)}</span>
                <span className="font-extrabold">{title}</span>
                <span className="truncate text-fg-muted">{detail}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

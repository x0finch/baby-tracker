import type { Event } from '@bobo/shared'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

import { Sheet } from '../../components/ui/Sheet'
import { Toast } from '../../components/ui/Toast'
import { useLocalStore } from '../../db'
import { formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { saveEvent } from './actions'
import { categoryDot } from './category'
import { describeEvent } from './describe'
import { EditEventForm } from './EditEventSheet'
import { restoreEvent } from './records'
import { startOfLocalDay } from './time'
import { useNow } from './use-events'

const UNDO_MS = 6000

/** Today's events for the selected baby, newest first; tap a row to edit it. */
export function TodayList({ events }: { events: readonly Event[] }) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Event | null>(null)
  const today = events.filter((event) => event.startAt >= startOfLocalDay(now))
  const editing = events.find((event) => event.id === editingId)
  const close = () => setEditingId(null)

  useEffect(() => {
    if (!deleted) return undefined
    const id = setTimeout(() => setDeleted(null), UNDO_MS)
    return () => clearTimeout(id)
  }, [deleted])

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-extrabold">{m.todaySummaryTitle()}</h2>
      {today.length === 0 ? (
        <p className="text-fg-muted">{m.todayEmpty()}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {today.map((event) => {
            const { title, detail } = describeEvent(event, now)
            const time = formatTime(event.startAt)
            return (
              <li key={event.id} className="border-b-2 border-border">
                <button
                  type="button"
                  aria-label={m.editEventLabel({ time, title })}
                  onClick={() => setEditingId(event.id)}
                  className="flex min-h-touch w-full items-center gap-3 py-3 text-left active:bg-surface"
                >
                  <span
                    aria-hidden
                    className={clsx('size-3 shrink-0 rounded-full', categoryDot[event.type])}
                  />
                  <span className="w-12 shrink-0 text-fg-muted tabular-nums">{time}</span>
                  <span className="shrink-0 font-extrabold">{title}</span>
                  <span className="truncate text-fg-muted">{detail}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={editing !== undefined} onClose={close} title={m.editEventTitle()}>
        {editing && (
          <EditEventForm
            key={editing.id}
            event={editing}
            events={events}
            onDone={close}
            onDeleted={setDeleted}
          />
        )}
      </Sheet>

      {deleted && (
        <Toast>
          <span>{m.eventDeleted()}</span>
          <button
            type="button"
            className="min-h-11 px-2 font-extrabold text-primary"
            onClick={() => {
              saveEvent(store, restoreEvent(deleted, Date.now()))
              setDeleted(null)
            }}
          >
            {m.undo()}
          </button>
        </Toast>
      )}
    </section>
  )
}

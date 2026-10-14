import { type Event, startOfLocalDay } from '@bobo/shared'
import { useEffect, useState } from 'react'

import { Sheet } from '../../components/ui/Sheet'
import { Toast, ToastAction } from '../../components/ui/Toast'
import { useLocalStore } from '../../db'
import { formatDate, formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { saveEvent } from './actions'
import { describeEvent } from './describe'
import { EditEventForm } from './EditEventSheet'
import { EventIcon, eventIconProps } from './EventIcon'
import { restoreEvent } from './records'
import { useNow } from './use-events'

const UNDO_MS = 6000

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A day's events for the selected baby, newest first; tap a row to edit it. Opens on today,
 * with arrows to step back to earlier days.
 */
export function TodayList({ events }: { events: readonly Event[] }) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Event | null>(null)
  const [daysBack, setDaysBack] = useState(0)
  const dayStart = startOfLocalDay(now, -daysBack)
  const dayEnd = startOfLocalDay(now, 1 - daysBack)
  const today = events.filter((event) => event.startAt >= dayStart && event.startAt < dayEnd)
  const heading =
    daysBack === 0
      ? m.todaySummaryTitle()
      : daysBack === 1
        ? m.yesterdayRecords()
        : m.dayRecords({ date: formatDate(dayStart) })
  const editing = events.find((event) => event.id === editingId)
  const close = () => setEditingId(null)

  useEffect(() => {
    if (!deleted) return undefined
    const id = setTimeout(() => setDeleted(null), UNDO_MS)
    return () => clearTimeout(id)
  }, [deleted])

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-extrabold">{heading}</h2>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={m.dayPrev()}
            onClick={() => setDaysBack((days) => days + 1)}
            className="flex size-touch items-center justify-center rounded-full text-fg-muted active:bg-surface"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            aria-label={m.dayNext()}
            disabled={daysBack === 0}
            onClick={() => setDaysBack((days) => Math.max(0, days - 1))}
            className="flex size-touch items-center justify-center rounded-full text-fg-muted active:bg-surface disabled:opacity-30"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>
      {daysBack > 0 && (
        <button
          type="button"
          onClick={() => setDaysBack(0)}
          className="self-start font-bold text-primary-text"
        >
          {m.backToToday()}
        </button>
      )}
      {today.length === 0 ? (
        <p className="text-fg-muted">{daysBack === 0 ? m.todayEmpty() : m.dayEmpty()}</p>
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
                  <EventIcon {...eventIconProps(event)} className="size-7" />
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
        <Toast
          action={
            <ToastAction
              onClick={() => {
                saveEvent(store, restoreEvent(deleted, Date.now()))
                setDeleted(null)
              }}
            >
              {m.undo()}
            </ToastAction>
          }
        >
          {m.eventDeleted()}
        </Toast>
      )}
    </section>
  )
}

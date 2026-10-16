import { type Event, startOfLocalDay } from '@bobo/shared'
import { AnimatePresence, m as motion } from 'motion/react'
import { useState } from 'react'

import { Chevron } from '../../components/ui/Chevron'
import { showToast } from '../../components/ui/Toast'
import { useLocalStore } from '../../db'
import { formatDate, formatTime } from '../../lib/i18n'
import { glowOnce, rowInOut, slideFromSide } from '../../lib/motion'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { saveEvent } from './actions'
import { describeEvent } from './describe'
import { EditEventSheet } from './EditEventSheet'
import { EventIcon, eventIconProps } from './EventIcon'
import { restoreEvent } from './records'

const UNDO_MS = 6000

/**
 * A day's events for the selected baby, newest first; tap a row to edit it. Opens on today,
 * with arrows to step back to earlier days.
 */
export function TodayList({ events }: { events: readonly Event[] }) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [daysBack, setDaysBack] = useState(0)
  // Which way the last day change went, so the list slides in from that side.
  const [direction, setDirection] = useState<1 | -1>(1)
  const showDay = (days: number) => {
    setDirection(days > daysBack ? -1 : 1)
    setDaysBack(days)
  }
  const dayStart = startOfLocalDay(now, -daysBack)
  const dayEnd = startOfLocalDay(now, 1 - daysBack)
  const today = events.filter((event) => event.startAt >= dayStart && event.startAt < dayEnd)
  const heading =
    daysBack === 0
      ? m.todaySummaryTitle()
      : daysBack === 1
        ? m.yesterdayRecords()
        : m.dayRecords({ date: formatDate(dayStart) })
  const close = () => setEditingId(null)

  const offerUndo = (deleted: Event) =>
    showToast(m.eventDeleted(), {
      id: 'event-deleted',
      duration: UNDO_MS,
      action: {
        label: m.undo(),
        onClick: () => saveEvent(store, restoreEvent(deleted, Date.now())),
      },
    })

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title font-extrabold">{heading}</h2>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={m.dayPrev()}
            onClick={() => showDay(daysBack + 1)}
            className="flex size-touch items-center justify-center rounded-full text-fg-muted active:bg-surface"
          >
            <Chevron direction="left" className="size-6" />
          </button>
          <button
            type="button"
            aria-label={m.dayNext()}
            disabled={daysBack === 0}
            onClick={() => showDay(Math.max(0, daysBack - 1))}
            className="flex size-touch items-center justify-center rounded-full text-fg-muted active:bg-surface disabled:opacity-30"
          >
            <Chevron direction="right" className="size-6" />
          </button>
        </div>
      </div>
      {daysBack > 0 && (
        <button
          type="button"
          onClick={() => showDay(0)}
          className="self-start font-bold text-primary-text"
        >
          {m.backToToday()}
        </button>
      )}
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        <motion.div key={daysBack} custom={direction} {...slideFromSide}>
          {today.length === 0 && (
            <p className="text-fg-muted">{daysBack === 0 ? m.todayEmpty() : m.dayEmpty()}</p>
          )}
          {/* Always mounted, so the first record of the day animates in like the rest. */}
          <ul className="m-0 flex list-none flex-col p-0">
            {/* New records slide in and glow briefly; deleted ones fold away. */}
            <AnimatePresence initial={false}>
              {today.map((event) => {
                const { title, detail } = describeEvent(event, now)
                const time = formatTime(event.startAt)
                return (
                  <motion.li
                    key={event.id}
                    layout="position"
                    {...rowInOut}
                    className="relative overflow-hidden border-b-2 border-border"
                  >
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-primary-soft"
                      {...glowOnce}
                    />
                    <button
                      type="button"
                      aria-label={m.editEventLabel({ time, title })}
                      onClick={() => setEditingId(event.id)}
                      className="relative flex min-h-touch w-full items-center gap-3 py-3 text-left active:bg-surface"
                    >
                      <EventIcon {...eventIconProps(event)} className="size-7" />
                      <span className="w-12 shrink-0 text-fg-muted tabular-nums">{time}</span>
                      <span className="shrink-0 font-extrabold">{title}</span>
                      <span className="truncate text-fg-muted">{detail}</span>
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </motion.div>
      </AnimatePresence>

      <EditEventSheet eventId={editingId} events={events} onClose={close} onDeleted={offerUndo} />
    </section>
  )
}

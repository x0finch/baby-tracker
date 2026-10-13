import { type Event, isTimed } from '@bobo/shared'
import { clsx } from 'clsx'

import { formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { categoryDot } from './category'
import { describeEvent } from './describe'

const HOUR_PX = 40
const HOUR_MS = 3_600_000
const MIN_BLOCK_PX = 10
const LANES = ['feeding', 'sleep', 'diaper'] as const
const laneTitles = { feeding: m.categoryFeeding, sleep: m.categorySleep, diaper: m.categoryDiaper }

/** Vertical 24-hour timeline with one lane per category; tap a block to edit it. */
export function DayTimeline({
  events,
  dayStart,
  dayEnd,
  now,
  onSelect,
}: {
  events: readonly Event[]
  dayStart: number
  dayEnd: number
  now: number
  onSelect: (event: Event) => void
}) {
  const visible = events.filter(
    (event) =>
      event.startAt < dayEnd && (event.endAt ?? (isTimed(event) ? now : event.startAt)) >= dayStart,
  )
  const hours = Math.round((dayEnd - dayStart) / HOUR_MS)
  const toPx = (at: number) =>
    ((Math.min(Math.max(at, dayStart), dayEnd) - dayStart) / HOUR_MS) * HOUR_PX
  const showNow = now >= dayStart && now < dayEnd

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-extrabold">{m.timelineTitle()}</h2>
      {visible.length === 0 && <p className="text-fg-muted">{m.timelineEmpty()}</p>}
      <div aria-hidden className="flex">
        <div className="w-12 shrink-0" />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center text-caption font-bold text-fg-muted">
          {LANES.map((lane) => (
            <span key={lane}>{laneTitles[lane]()}</span>
          ))}
        </div>
      </div>
      <div className="relative flex" style={{ height: hours * HOUR_PX }}>
        <div aria-hidden className="w-12 shrink-0">
          {Array.from({ length: hours }, (_, hour) => (
            <div
              key={hour}
              className="relative border-t border-border text-caption text-fg-muted tabular-nums"
              style={{ height: HOUR_PX }}
            >
              {hour % 3 === 0 && (
                <span className="absolute -top-2.5 bg-bg pr-1">
                  {String(hour).padStart(2, '0')}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="relative grid flex-1 grid-cols-3 gap-2">
          {LANES.map((lane) => (
            <div key={lane} className="relative rounded-md bg-surface">
              {visible
                .filter((event) => event.type === lane)
                .map((event) => {
                  const top = toPx(event.startAt)
                  const end = isTimed(event) ? (event.endAt ?? now) : event.startAt
                  const height = Math.max(toPx(end) - top, MIN_BLOCK_PX)
                  const { title, detail } = describeEvent(event, now)
                  return (
                    <button
                      key={event.id}
                      type="button"
                      aria-label={`${formatTime(event.startAt)} ${title} ${detail}`}
                      onClick={() => onSelect(event)}
                      className={clsx(
                        'absolute inset-x-1 rounded-sm border-2 border-bg',
                        categoryDot[event.type],
                        event.endAt === null && isTimed(event) && 'animate-pulse',
                      )}
                      style={{ top, height }}
                    />
                  )
                })}
            </div>
          ))}
          {showNow && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-0.5 bg-danger"
              style={{ top: toPx(now) }}
            />
          )}
        </div>
      </div>
    </section>
  )
}

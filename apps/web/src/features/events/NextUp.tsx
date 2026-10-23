import { type Baby, type Event, type PlanItem, type Window, nextUp } from '@bobo/shared'
import { clsx } from 'clsx'
import { useState } from 'react'

import { Card } from '../../components/ui/Card'
import { Chevron } from '../../components/ui/Chevron'
import { formatTime } from '../../lib/i18n'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { ageInMonths } from '../growth/growth'
import { durationLabel } from './duration-label'
import { EventIcon, type IconKind } from './EventIcon'

interface Row {
  icon: IconKind
  label: string
  window: Window
  /** A word more, such as how long a sleep likely lasts. */
  detail?: string
}

const sleepFor = (length: number) => m.nextSleepFor({ duration: durationLabel(length) })

const planLabel = (item: PlanItem) =>
  item.kind === 'feed' ? m.nextFeed() : `${m.nextSleep()} · ${sleepFor(item.length)}`

/**
 * What likely comes next, from the baby's age and last week: the next feed, sleep (or
 * waking) and diaper, and the next 12 hours on tap. Anything running is on its own card above.
 */
export function NextUp({ baby, events }: { baby: Baby; events: readonly Event[] }) {
  const now = useNow(60_000)
  const [open, setOpen] = useState(false)
  const next = nextUp(events, { months: ageInMonths(baby.birthDate, now), now })

  const rows: Row[] = []
  if (next.feed.status === 'predicted') {
    rows.push({ icon: 'bottle', label: m.nextFeed(), window: next.feed })
  }
  if (next.sleep.status === 'predicted') {
    rows.push({
      icon: 'sleep',
      label: m.nextSleep(),
      window: next.sleep,
      detail: sleepFor(next.sleep.length),
    })
  }
  if (next.sleep.status === 'sleeping' && next.sleep.wake) {
    rows.push({ icon: 'sleep', label: m.nextWake(), window: next.sleep.wake })
  }
  // A sleeping baby isn't changed on a schedule.
  if (next.diaper.status === 'predicted' && next.sleep.status !== 'sleeping') {
    rows.push({ icon: 'diaper', label: m.nextDiaper(), window: next.diaper })
  }
  // Nothing to go on yet: say what to log. Anything running has its own card already.
  const running = next.feed.status === 'feeding' || next.sleep.status === 'sleeping'
  if (rows.length === 0 && next.plan.length === 0 && running) return null
  const hint =
    rows.length === 0 && next.plan.length === 0
      ? m.nextUnknown()
      : next.sleep.status === 'unknown'
        ? m.nextSleepUnknown()
        : null

  return (
    <Card as="section" aria-labelledby="next-title" className="flex flex-col gap-3 py-3">
      <h2 id="next-title" className="m-0 text-caption font-bold text-fg-muted">
        {m.nextTitle()}
      </h2>
      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <EventIcon kind={row.icon} className="size-8" />
              <span className="flex flex-1 flex-col">
                <span className="text-caption text-fg-muted">
                  {row.detail ? `${row.label} · ${row.detail}` : row.label}
                </span>
                <span className="font-extrabold tabular-nums">
                  {m.nextWindow({
                    from: formatTime(row.window.from),
                    to: formatTime(row.window.to),
                  })}
                </span>
              </span>
              <span className="text-caption font-bold text-fg-muted">
                {now < row.window.from
                  ? m.nextIn({ duration: durationLabel(row.window.from - now) })
                  : now <= row.window.to
                    ? m.nextNow()
                    : m.nextLate()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {next.plan.length > 1 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 self-start font-bold text-primary"
          >
            {m.nextPlan()}
            <Chevron className={clsx('size-4 transition-transform', open && 'rotate-90')} />
          </button>
          {open && (
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {next.plan.map((item) => (
                <li key={`${item.kind}-${item.at}`} className="flex items-center gap-2">
                  <span className="w-14 font-bold tabular-nums">{formatTime(item.at)}</span>
                  <EventIcon kind={item.kind === 'feed' ? 'bottle' : 'sleep'} className="size-5" />
                  {planLabel(item)}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {hint && <p className="m-0 text-fg-muted">{hint}</p>}
      {rows.length > 0 && (
        <p className="m-0 text-caption text-fg-muted">
          {rows.some((row) => row.window.personalized) ? m.nextBasisHistory() : m.nextBasisAge()}
        </p>
      )}
    </Card>
  )
}

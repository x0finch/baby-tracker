import { type Event, type FeedingEvent, breastSideDurations, isRunning } from '@bobo/shared'
import { clsx } from 'clsx'

import { Button } from '../../components/ui/Button'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { saveEvent } from './actions'
import { currentBreastSide, stopEvent, switchBreastSide } from './records'
import { formatClock } from './time'
import { useNow } from './use-events'

const sideLabel = (side: 'left' | 'right') => (side === 'left' ? m.sideLeft() : m.sideRight())

function BreastTimer({ event, now }: { event: FeedingEvent; now: number }) {
  const store = useLocalStore()
  const canEdit = useAccess().canEditEvent(event)
  if (event.data.kind !== 'breast') return null
  const side = currentBreastSide(event) ?? 'left'
  const totals = breastSideDurations(event.data.segments, now)
  const other = side === 'left' ? 'right' : 'left'

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-b-4 border-feeding/40 bg-feeding-soft p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-extrabold text-feeding-text">
          {m.timerCurrentSide({ side: sideLabel(side) })}
        </span>
        <span className="text-display font-extrabold tabular-nums" role="timer">
          {formatClock(now - event.startAt)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        {(['left', 'right'] as const).map((s) => (
          <div
            key={s}
            className={clsx(
              'rounded-lg border-2 py-1',
              s === side
                ? 'border-feeding bg-bg font-extrabold'
                : 'border-transparent text-fg-muted',
            )}
          >
            <div className="text-caption">{sideLabel(s)}</div>
            <div className="tabular-nums">{formatClock(totals[s])}</div>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            tone="feeding"
            onClick={() => saveEvent(store, switchBreastSide(event, Date.now()))}
          >
            {m.timerSwitchSide({ side: sideLabel(other) })}
          </Button>
          <Button tone="feeding" onClick={() => saveEvent(store, stopEvent(event, Date.now()))}>
            {m.timerStop()}
          </Button>
        </div>
      )}
    </div>
  )
}

function SleepTimer({ event, now }: { event: Event; now: number }) {
  const store = useLocalStore()
  const canEdit = useAccess().canEditEvent(event)
  return (
    <div className="flex items-center gap-4 rounded-xl border-2 border-b-4 border-sleep/40 bg-sleep-soft p-4">
      <div className="flex flex-1 flex-col">
        <span className="font-extrabold text-sleep-text">{m.timerSleeping()}</span>
        <span className="text-display font-extrabold tabular-nums" role="timer">
          {formatClock(now - event.startAt)}
        </span>
      </div>
      {canEdit && (
        <Button
          tone="sleep"
          size="lg"
          onClick={() => saveEvent(store, stopEvent(event, Date.now()))}
        >
          {m.timerWake()}
        </Button>
      )}
    </div>
  )
}

/** Live cards for the selected baby's running timers, derived from stored timestamps. */
export function RunningTimers({ events }: { events: readonly Event[] }) {
  const running = events.filter(isRunning)
  const now = useNow(1000, running.length > 0)
  if (running.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {running.map((event) =>
        event.type === 'feeding' ? (
          <BreastTimer key={event.id} event={event} now={now} />
        ) : (
          <SleepTimer key={event.id} event={event} now={now} />
        ),
      )}
    </div>
  )
}

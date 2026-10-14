import { type Event, type FeedingEvent, breastSideDurations, isRunning } from '@bobo/shared'
import { clsx } from 'clsx'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useLocalStore } from '../../db'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { saveEvent } from './actions'
import { sideLabel } from './labels'
import { currentBreastSide, stopEvent, switchBreastSide } from './records'
import { formatClock } from './time'

function BreastTimer({ event, now }: { event: FeedingEvent; now: number }) {
  const store = useLocalStore()
  const canEdit = useAccess().canEditEvent(event)
  if (event.data.kind !== 'breast') return null
  const side = currentBreastSide(event) ?? 'left'
  const totals = breastSideDurations(event.data.segments, now)
  const other = side === 'left' ? 'right' : 'left'

  return (
    <Card tone="feeding" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-extrabold text-feeding-text">
          {m.timerCurrentSide({ side: sideLabel[side]() })}
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
            <div className="text-caption">{sideLabel[s]()}</div>
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
            {m.timerSwitchSide({ side: sideLabel[other]() })}
          </Button>
          <Button tone="feeding" onClick={() => saveEvent(store, stopEvent(event, Date.now()))}>
            {m.timerStop()}
          </Button>
        </div>
      )}
    </Card>
  )
}

function SleepTimer({ event, now }: { event: Event; now: number }) {
  const store = useLocalStore()
  const canEdit = useAccess().canEditEvent(event)
  return (
    <Card tone="sleep" className="flex items-center gap-4">
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
    </Card>
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

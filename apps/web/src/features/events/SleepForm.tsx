import type { Event } from '@bobo/shared'
import { isRunning } from '@bobo/shared'
import { type FormEvent, type ReactNode, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { useLocalStore } from '../../db'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { logSleep, startSleep } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useEventsByBaby } from './use-events'
import { overlapsSleep, validateTime } from './validation'

export function SleepForm({
  babyIds,
  events,
  targets,
  onDone,
}: {
  /** The selected baby first, then any logged together with it. */
  babyIds: readonly string[]
  /** Events of the selected baby. */
  events: readonly Event[]
  targets?: ReactNode
  onDone: () => void
}) {
  const store = useLocalStore()
  const eventsByBaby = useEventsByBaby(babyIds)
  const others = babyIds.slice(1)
  // Time the sheet opened; the form defaults and the max selectable time derive from it.
  const now = useNow(60_000)
  const [start, setStart] = useState(() => toDateTimeLocal(now - 60 * 60_000))
  const [end, setEnd] = useState(() => toDateTimeLocal(now))
  const [errors, setErrors] = useState<{ start?: string; end?: string; form?: string }>({})
  const running = events.some((event) => event.type === 'sleep' && isRunning(event))

  function startNow() {
    const current = Date.now()
    if (overlapsSleep(events, current, current + 1, current)) {
      setErrors({ form: m.sleepOverlap() })
      return
    }
    for (const babyId of babyIds) {
      // A baby logged together that is already asleep keeps its running timer.
      const theirs = babyId === babyIds[0] ? events : (eventsByBaby.get(babyId) ?? [])
      if (!overlapsSleep(theirs, current, current + 1, current)) {
        addEvent(store, startSleep(babyId, current))
      }
    }
    onDone()
  }

  function backfill(event: FormEvent) {
    event.preventDefault()
    const current = Date.now()
    const startResult = validateTime(start, current)
    const endResult = validateTime(end, current)
    const nextErrors: typeof errors = {}
    if ('error' in startResult) nextErrors.start = startResult.error
    if ('error' in endResult) nextErrors.end = endResult.error
    if ('at' in startResult && 'at' in endResult) {
      if (endResult.at < startResult.at) nextErrors.end = m.eventEndBeforeStart()
      else if (overlapsSleep(events, startResult.at, endResult.at, current)) {
        nextErrors.form = m.sleepOverlap()
      } else {
        const clash = others.find((id) =>
          overlapsSleep(eventsByBaby.get(id) ?? [], startResult.at, endResult.at, current),
        )
        if (clash)
          nextErrors.form = m.sleepOverlapFor({ name: store.babies.get(clash)?.name ?? '' })
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !('at' in startResult) || !('at' in endResult)) {
      return
    }
    for (const babyId of babyIds) {
      addEvent(store, logSleep(babyId, startResult.at, endResult.at, current))
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      {targets}
      {running ? (
        <p className="text-fg-muted">{m.sleepAlreadyRunning()}</p>
      ) : (
        <Button tone="sleep" size="lg" block className="min-h-20" onClick={startNow}>
          {m.sleepStartNow()}
        </Button>
      )}
      <form
        noValidate
        onSubmit={backfill}
        className="flex flex-col gap-4 border-t-2 border-border pt-4"
      >
        <h3 className="font-extrabold">{m.sleepBackfill()}</h3>
        <TimeField
          label={m.eventStart()}
          value={start}
          onChange={setStart}
          error={errors.start}
          now={now}
        />
        <TimeField
          label={m.eventEnd()}
          value={end}
          onChange={setEnd}
          error={errors.end}
          now={now}
        />
        {errors.form && <FormError>{errors.form}</FormError>}
        <Button type="submit" variant="soft" tone="sleep" block>
          {m.actionSave()}
        </Button>
      </form>
    </div>
  )
}

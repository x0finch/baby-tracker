import type { Event } from '@bobo/shared'
import { isRunning } from '@bobo/shared'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { logSleep, startSleep } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { overlapsSleep, validateTime } from './validation'

export function SleepSheetContent({
  babyId,
  events,
  onDone,
}: {
  babyId: string
  events: readonly Event[]
  onDone: () => void
}) {
  const store = useLocalStore()
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
    addEvent(store, startSleep(babyId, current))
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
      if (endResult.at < startResult.at) nextErrors.end = m.endBeforeStart()
      else if (overlapsSleep(events, startResult.at, endResult.at, current)) {
        nextErrors.form = m.sleepOverlap()
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !('at' in startResult) || !('at' in endResult)) {
      return
    }
    addEvent(store, logSleep(babyId, startResult.at, endResult.at, current))
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
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
        {errors.form && <p className="font-bold text-danger-text">{errors.form}</p>}
        <Button type="submit" variant="soft" tone="sleep" block>
          {m.actionSave()}
        </Button>
      </form>
    </div>
  )
}

import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { DEFAULT_PEE, type DiaperData, DiaperFields } from './DiaperFields'
import { logDiaper } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { validateTime } from './validation'

export function DiaperSheetContent({ babyId, onDone }: { babyId: string; onDone: () => void }) {
  const store = useLocalStore()
  // Time the sheet opened; the form defaults and the max selectable time derive from it.
  const now = useNow(60_000)
  const [time, setTime] = useState(() => toDateTimeLocal(now))
  const [diaper, setDiaper] = useState<DiaperData>({ contents: 'wet', pee: DEFAULT_PEE })
  const [error, setError] = useState<string>()

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    const current = Date.now()
    const result = validateTime(time, current)
    if ('error' in result) {
      setError(result.error)
      return
    }
    addEvent(store, logDiaper(babyId, result.at, diaper, current))
    onDone()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <TimeField label={m.eventTime()} value={time} onChange={setTime} error={error} now={now} />
      <DiaperFields value={diaper} onChange={setDiaper} />
      <Button type="submit" tone="diaper" size="lg" block>
        {m.actionSave()}
      </Button>
    </form>
  )
}

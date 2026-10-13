import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { logDiaper } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { validateTime } from './validation'

type Contents = 'wet' | 'dirty' | 'mixed'

export function DiaperSheetContent({ babyId, onDone }: { babyId: string; onDone: () => void }) {
  const store = useLocalStore()
  // Time the sheet opened; the form defaults and the max selectable time derive from it.
  const now = useNow(60_000)
  const [time, setTime] = useState(() => toDateTimeLocal(now))
  const [error, setError] = useState<string>()

  function log(contents: Contents) {
    // Click handler, not render; the rule cannot see that it only runs from onClick.
    // oxlint-disable-next-line react/purity
    const current = Date.now()
    const result = validateTime(time, current)
    if ('error' in result) {
      setError(result.error)
      return
    }
    addEvent(store, logDiaper(babyId, result.at, contents, current))
    onDone()
  }

  const options: { value: Contents; label: string }[] = [
    { value: 'wet', label: m.diaperWet() },
    { value: 'dirty', label: m.diaperDirty() },
    { value: 'mixed', label: m.diaperMixed() },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <Button
            key={option.value}
            tone="diaper"
            size="lg"
            className="min-h-20"
            onClick={() => log(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <TimeField label={m.eventTime()} value={time} onChange={setTime} error={error} now={now} />
    </div>
  )
}

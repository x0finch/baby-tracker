import { localDateString, localMidnight, shiftDay } from '@bobo/shared'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { useBabies } from '../babies/use-babies'
import { useBabyEvents } from '../events/use-events'
import { csvFileName, downloadCsv, eventsToCsv, exportRangeLabel } from './csv'

/** Exports one baby's events in a date range as CSV, entirely on the device. */
export function ExportCard() {
  const { active, archived } = useBabies()
  const babies = [...active, ...archived]
  const now = useNow(60_000)
  const today = localDateString(now)
  const [babyId, setBabyId] = useState<string | null>(null)
  const baby = babies.find((item) => item.id === babyId) ?? babies[0]
  const events = useBabyEvents(baby?.id ?? '')
  const [from, setFrom] = useState(() => shiftDay(today, -29))
  const [to, setTo] = useState(today)

  if (!baby) return null
  const start = localMidnight(from)
  // The end date is inclusive.
  const end = localMidnight(to, 1)
  const valid = from !== '' && to !== '' && start < end
  const count = valid
    ? events.filter((event) => event.startAt >= start && event.startAt < end).length
    : 0

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.exportTitle()}</h2>
      <p className="m-0 text-fg-muted">{m.exportBody()}</p>
      {babies.length > 1 && (
        <SegmentedControl<string>
          label={m.exportBaby()}
          options={babies.map((item) => ({ value: item.id, label: item.name }))}
          value={baby.id}
          onChange={setBabyId}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={m.exportFrom()}
          type="date"
          value={from}
          max={to || today}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label={m.exportTo()}
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <p className="m-0 text-caption text-fg-muted" aria-live="polite">
        {!valid
          ? m.exportRangeInvalid()
          : count === 0
            ? m.exportEmpty()
            : m.exportCount({ count, range: exportRangeLabel(start, end) })}
      </p>
      <Button
        variant="soft"
        tone="primary"
        block
        disabled={!valid || count === 0}
        onClick={() =>
          downloadCsv(
            csvFileName(baby.name, start, end),
            eventsToCsv(baby, events, start, end, Date.now()),
          )
        }
      >
        {m.exportButton()}
      </Button>
    </Card>
  )
}

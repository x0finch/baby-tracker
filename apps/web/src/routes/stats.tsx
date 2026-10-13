import { localDateString } from '@bobo/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { RequireBaby } from '../features/babies/RequireBaby'
import { useSelectedBaby } from '../features/babies/use-babies'
import { DaySummaryCards } from '../features/events/DaySummaryCards'
import { DayTimeline } from '../features/events/DayTimeline'
import { EditEventForm } from '../features/events/EditEventSheet'
import { useBabyEvents, useNow } from '../features/events/use-events'
import { formatDate } from '../lib/i18n'
import { m } from '../paraglide/messages.js'

const searchSchema = z.object({
  day: z.iso.date().optional().catch(undefined),
})

export const Route = createFileRoute('/stats')({
  validateSearch: searchSchema,
  component: StatsPage,
})

function StatsPage() {
  return (
    <RequireBaby>
      <PageHeader title={m.statsTitle()} />
      <DayView />
    </RequireBaby>
  )
}

/** Local midnight of a "YYYY-MM-DD" day and of the next day (DST-safe). */
function dayBounds(day: string): [number, number] {
  const [y = 0, mo = 1, d = 1] = day.split('-').map(Number)
  return [new Date(y, mo - 1, d).getTime(), new Date(y, mo - 1, d + 1).getTime()]
}

function shiftDay(day: string, delta: number): string {
  const [y = 0, mo = 1, d = 1] = day.split('-').map(Number)
  return localDateString(new Date(y, mo - 1, d + delta))
}

function DayView() {
  const { baby } = useSelectedBaby()
  const events = useBabyEvents(baby?.id ?? '')
  const now = useNow(60_000)
  const today = localDateString(now)
  const { day = today } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = events.find((event) => event.id === editingId)
  const [dayStart, dayEnd] = dayBounds(day)
  const isToday = day >= today
  const goTo = (next: string) =>
    void navigate({ search: { day: next >= today ? undefined : next }, replace: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => goTo(shiftDay(day, -1))}>
          {m.dayPrev()}
        </Button>
        <span className="font-extrabold">{isToday ? m.dayToday() : formatDate(dayStart)}</span>
        <Button variant="outline" disabled={isToday} onClick={() => goTo(shiftDay(day, 1))}>
          {m.dayNext()}
        </Button>
      </div>
      <DaySummaryCards events={events} dayStart={dayStart} dayEnd={dayEnd} now={now} />
      <DayTimeline
        events={events}
        dayStart={dayStart}
        dayEnd={dayEnd}
        now={now}
        onSelect={(event) => setEditingId(event.id)}
      />
      <Sheet
        open={editing !== undefined}
        onClose={() => setEditingId(null)}
        title={m.editEventTitle()}
      >
        {editing && (
          <EditEventForm
            key={editing.id}
            event={editing}
            events={events}
            onDone={() => setEditingId(null)}
            onDeleted={() => undefined}
          />
        )}
      </Sheet>
    </div>
  )
}

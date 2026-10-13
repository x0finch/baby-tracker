import { createFileRoute } from '@tanstack/react-router'

import { RequireBaby } from '../features/babies/RequireBaby'
import { useSelectedBaby } from '../features/babies/use-babies'
import { QuickActions } from '../features/events/QuickActions'
import { RunningTimers } from '../features/events/RunningTimers'
import { TodayList } from '../features/events/TodayList'
import { useBabyEvents } from '../features/events/use-events'

export const Route = createFileRoute('/')({
  component: TodayPage,
})

function TodayPage() {
  return (
    <RequireBaby>
      <Today />
    </RequireBaby>
  )
}

function Today() {
  const { baby } = useSelectedBaby()
  if (!baby) return null
  return <BabyToday key={baby.id} babyId={baby.id} />
}

function BabyToday({ babyId }: { babyId: string }) {
  const events = useBabyEvents(babyId)
  return (
    <div className="flex flex-col gap-6">
      <RunningTimers events={events} />
      <QuickActions babyId={babyId} events={events} />
      <TodayList events={events} />
    </div>
  )
}

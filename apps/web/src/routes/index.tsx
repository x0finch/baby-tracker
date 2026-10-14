import type { Baby } from '@bobo/shared'
import { createFileRoute } from '@tanstack/react-router'

import { Card } from '../components/ui/Card'
import { RequireBaby } from '../features/babies/RequireBaby'
import { useSelectedBaby } from '../features/babies/use-babies'
import { QuickActions } from '../features/events/QuickActions'
import { RunningTimers } from '../features/events/RunningTimers'
import { SinceLast } from '../features/events/SinceLast'
import { TodayList } from '../features/events/TodayList'
import { useBabyEvents } from '../features/events/use-events'
import { m } from '../paraglide/messages.js'
import { useAccess } from '../sync/use-access'

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
  return <BabyToday key={baby.id} baby={baby} />
}

function BabyToday({ baby }: { baby: Baby }) {
  const events = useBabyEvents(baby.id)
  const { canLog } = useAccess().forBaby(baby)
  return (
    <div className="flex flex-col gap-6">
      <SinceLast events={events} />
      <RunningTimers events={events} />
      {canLog ? (
        <QuickActions babyId={baby.id} events={events} />
      ) : (
        <Card>
          <p className="m-0 text-fg-muted">{m.viewerNotice()}</p>
        </Card>
      )}
      <TodayList events={events} />
    </div>
  )
}

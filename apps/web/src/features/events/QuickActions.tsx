import type { Event } from '@bobo/shared'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { categoryTone } from './category'
import type { Category } from './describe'
import { DiaperSheetContent } from './DiaperSheet'
import { FeedingSheetContent } from './FeedingSheet'
import { SleepSheetContent } from './SleepSheet'

const titles: Record<Category, () => string> = {
  feeding: m.categoryFeeding,
  sleep: m.categorySleep,
  diaper: m.categoryDiaper,
}

/** The three big logging buttons; each opens its sheet. */
export function QuickActions({ babyId, events }: { babyId: string; events: readonly Event[] }) {
  const [open, setOpen] = useState<Category | null>(null)
  const close = () => setOpen(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {(['feeding', 'sleep', 'diaper'] as const).map((category) => (
          <Button
            key={category}
            tone={categoryTone[category]}
            size="lg"
            className="min-h-24"
            onClick={() => setOpen(category)}
          >
            {titles[category]()}
          </Button>
        ))}
      </div>
      {(['feeding', 'sleep', 'diaper'] as const).map((category) => (
        <Sheet key={category} open={open === category} onClose={close} title={titles[category]()}>
          {open === category && category === 'feeding' && (
            <FeedingSheetContent babyId={babyId} events={events} onDone={close} />
          )}
          {open === category && category === 'sleep' && (
            <SleepSheetContent babyId={babyId} events={events} onDone={close} />
          )}
          {open === category && category === 'diaper' && (
            <DiaperSheetContent babyId={babyId} onDone={close} />
          )}
        </Sheet>
      ))}
    </>
  )
}

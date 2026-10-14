import type { Event } from '@bobo/shared'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { OTHER_CATEGORIES, type OtherCategory, categoryTone } from './category'
import { type Category, categoryTitle } from './describe'
import { DiaperSheetContent } from './DiaperSheet'
import { FeedingSheetContent } from './FeedingSheet'
import { OtherEventForm } from './OtherEventSheet'
import { SleepSheetContent } from './SleepSheet'

const MAIN_CATEGORIES = ['feeding', 'sleep', 'diaper'] as const

/** The three big logging buttons plus a menu for the other types; each opens its sheet. */
export function QuickActions({ babyId, events }: { babyId: string; events: readonly Event[] }) {
  const [open, setOpen] = useState<Category | 'more' | null>(null)
  const close = () => setOpen(null)
  const other = OTHER_CATEGORIES.find((category) => category === open)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          {MAIN_CATEGORIES.map((category) => (
            <Button
              key={category}
              tone={categoryTone[category]}
              size="lg"
              className="min-h-24"
              onClick={() => setOpen(category)}
            >
              {categoryTitle[category]()}
            </Button>
          ))}
        </div>
        <Button variant="soft" tone="primary" block onClick={() => setOpen('more')}>
          {m.moreRecords()}
        </Button>
      </div>
      {MAIN_CATEGORIES.map((category) => (
        <Sheet
          key={category}
          open={open === category}
          onClose={close}
          title={categoryTitle[category]()}
        >
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
      <Sheet open={open === 'more'} onClose={close} title={m.moreRecords()}>
        <div className="grid grid-cols-2 gap-3">
          {OTHER_CATEGORIES.map((category) => (
            <Button
              key={category}
              variant="soft"
              tone={categoryTone[category]}
              size="lg"
              className="min-h-20"
              onClick={() => setOpen(category)}
            >
              {categoryTitle[category]()}
            </Button>
          ))}
        </div>
      </Sheet>
      <OtherSheet category={other} babyId={babyId} onClose={close} />
    </>
  )
}

function OtherSheet({
  category,
  babyId,
  onClose,
}: {
  category: OtherCategory | undefined
  babyId: string
  onClose: () => void
}) {
  return (
    <Sheet
      open={category !== undefined}
      onClose={onClose}
      title={category ? categoryTitle[category]() : ''}
    >
      {category && (
        <OtherEventForm key={category} category={category} babyId={babyId} onDone={onClose} />
      )}
    </Sheet>
  )
}

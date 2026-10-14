import type { Baby, Event } from '@bobo/shared'
import { type ReactNode, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useBabies } from '../babies/use-babies'
import { OTHER_CATEGORIES, type OtherCategory, categoryTone } from './category'
import { type Category, categoryTitle } from './describe'
import { DiaperSheetContent } from './DiaperSheet'
import { FeedingSheetContent } from './FeedingSheet'
import { useLogTogether } from './log-targets'
import { LogTargets } from './LogTargets'
import { OtherEventForm } from './OtherEventSheet'
import { SleepSheetContent } from './SleepSheet'

const MAIN_CATEGORIES = ['feeding', 'sleep', 'diaper'] as const

/**
 * The three big logging buttons plus a menu for the other types; each opens its sheet. With
 * more than one baby, records can be saved for several at once (e.g. twins).
 */
export function QuickActions({ baby, events }: { baby: Baby; events: readonly Event[] }) {
  const babyId = baby.id
  const { active } = useBabies()
  const access = useAccess()
  const { together, toggle } = useLogTogether()
  const others = active.filter((other) => other.id !== babyId && access.forBaby(other).canLog)
  const selected = new Set(
    together.has(babyId) ? others.filter((other) => together.has(other.id)).map((o) => o.id) : [],
  )
  const babyIds = [babyId, ...selected]
  const targets =
    others.length > 0 ? (
      <LogTargets
        current={baby}
        others={others}
        selected={selected}
        onToggle={(id) => toggle(id, babyId)}
      />
    ) : null
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
          title={category === 'diaper' ? m.diaperSheetTitle() : categoryTitle[category]()}
        >
          {open === category && category === 'feeding' && (
            <FeedingSheetContent
              babyIds={babyIds}
              events={events}
              targets={targets}
              onDone={close}
            />
          )}
          {open === category && category === 'sleep' && (
            <SleepSheetContent babyIds={babyIds} events={events} targets={targets} onDone={close} />
          )}
          {open === category && category === 'diaper' && (
            <DiaperSheetContent babyIds={babyIds} targets={targets} onDone={close} />
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
      <OtherSheet category={other} babyIds={babyIds} targets={targets} onClose={close} />
    </>
  )
}

function OtherSheet({
  category,
  babyIds,
  targets,
  onClose,
}: {
  category: OtherCategory | undefined
  babyIds: readonly string[]
  targets: ReactNode
  onClose: () => void
}) {
  return (
    <Sheet
      open={category !== undefined}
      onClose={onClose}
      title={category ? categoryTitle[category]() : ''}
    >
      {category && (
        <div className="flex flex-col gap-4">
          {targets}
          <OtherEventForm key={category} category={category} babyIds={babyIds} onDone={onClose} />
        </div>
      )}
    </Sheet>
  )
}

import type { BreastSide, Event, FeedingEvent } from '@bobo/shared'
import { isRunning } from '@bobo/shared'
import { type FormEvent, type ReactNode, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { type Milk, parseBottle } from './bottle-input'
import { MixedAmounts } from './MixedAmounts'
import { logBottle, logSolids, startBreastFeed, suggestedBreastSide } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { validateTime } from './validation'

type Kind = 'breast' | 'bottle' | 'solids'

const QUICK_AMOUNTS = [60, 90, 120, 150] as const

export function FeedingSheetContent({
  babyIds,
  events,
  targets,
  onDone,
}: {
  /** The selected baby first; breastfeeding is only timed for it. */
  babyIds: readonly string[]
  events: readonly Event[]
  targets?: ReactNode
  onDone: () => void
}) {
  const babyId = babyIds[0] ?? ''
  const store = useLocalStore()
  const [kind, setKind] = useState<Kind>('breast')
  // Time the sheet opened; the form defaults and the max selectable time derive from it.
  const now = useNow(60_000)
  const [time, setTime] = useState(() => toDateTimeLocal(now))
  const [amount, setAmount] = useState('')
  const [milk, setMilk] = useState<Milk>('formula')
  const [breastPart, setBreastPart] = useState('')
  const [formulaPart, setFormulaPart] = useState('')
  const [food, setFood] = useState('')
  const [errors, setErrors] = useState<{ time?: string; amount?: string; food?: string }>({})

  const feeds = events.filter((event): event is FeedingEvent => event.type === 'feeding')
  const runningBreast = feeds.find((event) => event.data.kind === 'breast' && isRunning(event))
  const lastBreast = feeds.find((event) => event.data.kind === 'breast')
  const suggested = suggestedBreastSide(lastBreast)

  function startBreast(side: BreastSide) {
    // Click handler, not render; the rule cannot see that it only runs from onClick.
    // oxlint-disable-next-line react/purity
    addEvent(store, startBreastFeed(babyId, side, Date.now()))
    onDone()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const current = Date.now()
    const timeResult = validateTime(time, current)
    const nextErrors: typeof errors = {}
    if ('error' in timeResult) nextErrors.time = timeResult.error
    const bottle = parseBottle({ milk, amount, breast: breastPart, formula: formulaPart })
    if (kind === 'bottle' && 'error' in bottle) nextErrors.amount = bottle.error
    if (kind === 'solids' && !food.trim()) nextErrors.food = m.solidsFoodRequired()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !('at' in timeResult)) return

    const at = timeResult.at
    for (const id of babyIds) {
      addEvent(
        store,
        kind === 'bottle' && 'amountMl' in bottle
          ? logBottle(id, at, bottle.amountMl, milk, current, bottle.split)
          : logSolids(id, at, food, current),
      )
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<Kind>
        label={m.categoryFeeding()}
        options={[
          { value: 'breast', label: m.feedingBreast() },
          { value: 'bottle', label: m.feedingBottle() },
          { value: 'solids', label: m.feedingSolids() },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind !== 'breast' && targets}

      {kind === 'breast' &&
        (runningBreast ? (
          <p className="text-fg-muted">{m.breastAlreadyRunning()}</p>
        ) : (
          <>
            <p className="text-fg-muted">{m.breastStartHint()}</p>
            <div className="grid grid-cols-2 gap-3">
              {(['left', 'right'] as const).map((side) => (
                <Button
                  key={side}
                  tone="feeding"
                  size="lg"
                  className="relative min-h-24"
                  onClick={() => startBreast(side)}
                >
                  {side === 'left' ? m.sideLeft() : m.sideRight()}
                  {side === suggested && (
                    <span className="absolute top-2 right-2 rounded-full bg-on-accent px-2 text-caption text-feeding-text">
                      {m.sideSuggested()}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </>
        ))}

      {kind !== 'breast' && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {kind === 'bottle' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="font-bold">{m.bottleMilk()}</span>
                <SegmentedControl<Milk>
                  label={m.bottleMilk()}
                  options={[
                    { value: 'formula', label: m.milkFormula() },
                    { value: 'breast', label: m.milkBreast() },
                    { value: 'mixed', label: m.milkMixed() },
                  ]}
                  value={milk}
                  onChange={setMilk}
                />
              </div>
              {milk === 'mixed' ? (
                <MixedAmounts
                  breast={breastPart}
                  formula={formulaPart}
                  error={errors.amount}
                  onBreast={setBreastPart}
                  onFormula={setFormulaPart}
                />
              ) : (
                <>
                  <Input
                    label={m.bottleAmount()}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    value={amount}
                    error={errors.amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((value) => (
                      <Button
                        key={value}
                        variant={amount === String(value) ? 'solid' : 'soft'}
                        tone="feeding"
                        aria-pressed={amount === String(value)}
                        onClick={() => setAmount(String(value))}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {kind === 'solids' && (
            <Input
              label={m.solidsFood()}
              placeholder={m.solidsFoodPlaceholder()}
              value={food}
              maxLength={100}
              error={errors.food}
              onChange={(event) => setFood(event.target.value)}
            />
          )}
          <TimeField
            label={m.eventTime()}
            value={time}
            onChange={setTime}
            error={errors.time}
            now={now}
          />
          <Button type="submit" tone="feeding" size="lg" block>
            {m.actionSave()}
          </Button>
        </form>
      )}
    </div>
  )
}

import type { DiaperEvent, PeeDetails, PoopDetails } from '@bobo/shared'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { m } from '../../paraglide/messages.js'
import { amountLabel, poopColorLabel, poopConsistencyLabel } from './diaper-labels'
import { DiaperIcon } from './DiaperIcon'

export type DiaperData = DiaperEvent['data']
type Contents = DiaperData['contents']

export const DEFAULT_PEE: PeeDetails = { amount: 'normal' }
export const DEFAULT_POOP: PoopDetails = { amount: 'normal', color: 'yellow', consistency: 'soft' }

/** Colors worth a doctor's look when they keep appearing. */
const WARNING_COLORS: ReadonlySet<PoopDetails['color']> = new Set(['black', 'red', 'white'])

const contentsOptions: { value: Contents; label: () => string }[] = [
  { value: 'wet', label: m.diaperWet },
  { value: 'dirty', label: m.diaperDirty },
  { value: 'mixed', label: m.diaperMixed },
]

function ChoiceCard({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-center gap-1 rounded-xl border-2 border-b-4 px-2 pt-2 pb-3 font-extrabold',
        'transition-[transform,border-width] duration-75 active:translate-y-0.5 active:border-b-2',
        selected ? 'border-diaper bg-diaper-soft' : 'border-border bg-surface',
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-diaper text-on-accent"
        >
          <svg viewBox="0 0 24 24" className="size-4">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      {children}
      <span>{label}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-caption font-bold text-diaper-text">{children}</h3>
}

/** Diaper type cards and, for diapers with poop, amount, color and consistency. */
export function DiaperFields({
  value,
  onChange,
}: {
  value: DiaperData
  onChange: (value: DiaperData) => void
}) {
  const pee = value.pee ?? DEFAULT_PEE
  const poop = value.poop ?? DEFAULT_POOP
  const hasPee = value.contents !== 'dirty'
  const hasPoop = value.contents !== 'wet'
  // Each kind of contents carries only the details that apply to it.
  const setContents = (contents: Contents) =>
    onChange(
      contents === 'wet'
        ? { contents, pee }
        : contents === 'dirty'
          ? { contents, poop }
          : { contents, pee, poop },
    )
  const setPee = (patch: Partial<PeeDetails>) => onChange({ ...value, pee: { ...pee, ...patch } })
  const setPoop = (patch: Partial<PoopDetails>) =>
    onChange({ ...value, poop: { ...poop, ...patch } })

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <SectionLabel>{m.diaperType()}</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {contentsOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              selected={value.contents === option.value}
              label={option.label()}
              onClick={() => setContents(option.value)}
            >
              <DiaperIcon
                className="h-14 w-full"
                wet={option.value !== 'dirty'}
                poop={option.value === 'wet' ? undefined : 'yellow'}
              />
            </ChoiceCard>
          ))}
        </div>
      </section>

      {hasPee && (
        <section className="flex flex-col gap-4">
          <SectionLabel>{m.peeSection()}</SectionLabel>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-muted">{m.peeAmount()}</span>
            <SegmentedControl<PeeDetails['amount']>
              label={m.peeAmount()}
              options={(['small', 'normal', 'large'] as const).map((amount) => ({
                value: amount,
                label: amountLabel[amount](),
              }))}
              value={pee.amount}
              onChange={(amount) => setPee({ amount })}
            />
          </div>
        </section>
      )}

      {hasPoop && (
        <section className="flex flex-col gap-4">
          <SectionLabel>{m.poopSection()}</SectionLabel>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-muted">{m.poopAmount()}</span>
            <SegmentedControl<PoopDetails['amount']>
              label={m.poopAmount()}
              options={(['small', 'normal', 'large'] as const).map((amount) => ({
                value: amount,
                label: amountLabel[amount](),
              }))}
              value={poop.amount}
              onChange={(amount) => setPoop({ amount })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-muted">{m.poopColor()}</span>
            <div className="grid grid-cols-3 gap-3">
              {(['yellow', 'brown', 'green', 'black', 'red', 'white'] as const).map((color) => (
                <ChoiceCard
                  key={color}
                  selected={poop.color === color}
                  label={poopColorLabel[color]()}
                  onClick={() => setPoop({ color })}
                >
                  <DiaperIcon className="h-14 w-full" poop={color} />
                </ChoiceCard>
              ))}
            </div>
            {WARNING_COLORS.has(poop.color) && (
              <p className="m-0 text-caption font-bold text-danger-text">{m.poopColorWarning()}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-muted">{m.poopConsistency()}</span>
            <SegmentedControl<PoopDetails['consistency']>
              label={m.poopConsistency()}
              options={(['watery', 'soft', 'hard'] as const).map((consistency) => ({
                value: consistency,
                label: poopConsistencyLabel[consistency](),
              }))}
              value={poop.consistency}
              onChange={(consistency) => setPoop({ consistency })}
            />
          </div>
        </section>
      )}
    </div>
  )
}

import {
  type BreastSide,
  type Event,
  type FeedingEvent,
  MINUTE,
  RECORD_KINDS,
  isRunning,
  recordKind,
} from '@bobo/shared'
import { type FormEvent, type ReactNode, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { formatTime } from '../../lib/i18n'
import { quantityInputProps, unitLabel } from '../../lib/units'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { DurationField } from './DurationField'
import { emptyBottle, parseBottleDraft, parseSolids } from './event-draft'
import { BottleFields, SolidsField } from './EventFields'
import { type DurationKind, durationChipTone, durationTone } from './kinds'
import { optionsOf, sideLabel } from './labels'
import { parseVolume } from './measure-input'
import { AgoChips } from './QuickTimeField'
import { type DurationDetails, logRecord, startRecord, suggestedBreastSide } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useEventsByBaby } from './use-events'
import { overlapsSleep, validateTime } from './validation'

/** "How long ago it started" choices, in minutes. */
const STARTED_AGO = [5, 15, 30, 60, 120, 180] as const

type Errors = Partial<Record<'amount' | 'food' | 'start' | 'duration' | 'form', string>>
type PumpingSide = 'left' | 'right' | 'both'

const runningOf = (events: readonly Event[], kind: DurationKind) =>
  events.some((event) => isRunning(event) && recordKind(event) === kind)

/**
 * Logs a duration record (breastfeeding, bottle, solids, sleep, pumping): its details, then
 * either a timer started now or a record logged afterwards with when it started and how long
 * it took. Everything kind-specific comes from RECORD_KINDS and DURATION_LOOK.
 */
export function DurationForm({
  kind,
  babyIds,
  events,
  targets,
  onDone,
}: {
  kind: DurationKind
  /** The selected baby first, then any logged together with it. */
  babyIds: readonly string[]
  /** Events of the selected baby. */
  events: readonly Event[]
  targets?: ReactNode
  onDone: () => void
}) {
  const store = useLocalStore()
  const eventsByBaby = useEventsByBaby(babyIds)
  const definition = RECORD_KINDS[kind]
  // Time the sheet opened; the defaults and the latest selectable time derive from it.
  const now = useNow(60_000)
  const usual = definition.usualMinutes

  const lastBreast = events.find(
    (event): event is FeedingEvent => event.type === 'feeding' && event.data.kind === 'breast',
  )
  const [breastSide, setBreastSide] = useState<BreastSide>(() => suggestedBreastSide(lastBreast))
  const [pumpingSide, setPumpingSide] = useState<PumpingSide>('both')
  const [bottle, setBottle] = useState(emptyBottle)
  const [food, setFood] = useState('')
  const [amount, setAmount] = useState('')

  // Until a start is picked, the record is taken to have just ended: start = now − duration.
  const [startedAgo, setStartedAgo] = useState<number | null>(null)
  const [pickedStart, setPickedStart] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number | null>(usual)
  // Breastfeeding afterwards: minutes on each side, the first side first.
  const [sideMinutes, setSideMinutes] = useState<Record<BreastSide, number | null>>(() => ({
    left: null,
    right: null,
    [suggestedBreastSide(lastBreast)]: usual,
  }))
  const [errors, setErrors] = useState<Errors>({})

  const running = runningOf(events, kind)
  const totalMinutes =
    kind === 'breast' ? (sideMinutes.left ?? 0) + (sideMinutes.right ?? 0) : (minutes ?? 0)
  const start = pickedStart ?? toDateTimeLocal(now - totalMinutes * MINUTE)
  const startAt = validateTime(start, now)
  const endsAt = 'at' in startAt && totalMinutes > 0 ? startAt.at + totalMinutes * MINUTE : null

  /** The details for one record, or the errors that block it. */
  function details(afterwards: boolean): DurationDetails | Errors {
    switch (kind) {
      case 'breast':
        return {
          kind,
          side: breastSide,
          ...(afterwards && {
            sides: {
              left: (sideMinutes.left ?? 0) * MINUTE,
              right: (sideMinutes.right ?? 0) * MINUTE,
            },
          }),
        }
      case 'bottle': {
        const parsed = parseBottleDraft(bottle)
        return 'errors' in parsed ? parsed.errors : parsed.data
      }
      case 'solids': {
        const parsed = parseSolids(food)
        return 'errors' in parsed ? parsed.errors : parsed.data
      }
      case 'sleep':
        return { kind }
      case 'pumping': {
        // The amount is known at the end: asked when logging afterwards or stopping.
        if (!afterwards) return { kind, side: pumpingSide }
        const volume = parseVolume(amount)
        return 'error' in volume
          ? { amount: volume.error }
          : { kind, side: pumpingSide, amountMl: volume.amountMl }
      }
      default:
        return kind satisfies never
    }
  }

  const eventsOf = (babyId: string) =>
    babyId === babyIds[0] ? events : (eventsByBaby.get(babyId) ?? [])

  function startNow() {
    const record = details(false)
    if (!('kind' in record)) {
      setErrors(record)
      return
    }
    const current = Date.now()
    for (const babyId of babyIds) {
      const theirs = eventsOf(babyId)
      // A baby logged together that already has this timer running keeps it.
      const busy =
        runningOf(theirs, kind) ||
        (kind === 'sleep' && overlapsSleep(theirs, current, current + 1, current))
      if (!busy) addEvent(store, startRecord(babyId, record, current))
    }
    onDone()
  }

  function logAfterwards(formEvent: FormEvent) {
    formEvent.preventDefault()
    const current = Date.now()
    const record = details(true)
    const next: Errors = 'kind' in record ? {} : record
    const startResult = validateTime(start, current)
    if ('error' in startResult) next.start = startResult.error
    if (totalMinutes <= 0) next.duration = m.durationRequired()
    const from = 'at' in startResult ? startResult.at : current
    const to = from + totalMinutes * MINUTE
    if (!next.start && !next.duration) {
      if (to > current + MINUTE) next.duration = m.durationEndFuture()
      else if (kind === 'sleep') {
        const clash = babyIds.find((id) => overlapsSleep(eventsOf(id), from, to, current))
        if (clash === babyIds[0]) next.form = m.sleepOverlap()
        else if (clash) next.form = m.sleepOverlapFor({ name: store.babies.get(clash)?.name ?? '' })
      }
    }
    setErrors(next)
    if (Object.keys(next).length > 0 || !('kind' in record)) return
    for (const babyId of babyIds) addEvent(store, logRecord(babyId, record, from, to, current))
    onDone()
  }

  const chipTone = durationChipTone(kind)

  return (
    <div className="flex flex-col gap-4">
      {targets}
      {kind === 'breast' && (
        <SegmentedControl<BreastSide>
          label={m.breastFirstSide()}
          labelStyle="field"
          options={(['left', 'right'] as const).map((side) => ({
            value: side,
            label:
              side === suggestedBreastSide(lastBreast)
                ? m.sideWithSuggestion({ side: sideLabel[side]() })
                : sideLabel[side](),
          }))}
          value={breastSide}
          onChange={setBreastSide}
        />
      )}
      {kind === 'pumping' && (
        <SegmentedControl<PumpingSide>
          label={m.pumpingSide()}
          labelStyle="field"
          options={optionsOf(sideLabel, definition.sides)}
          value={pumpingSide}
          onChange={setPumpingSide}
        />
      )}
      {kind === 'bottle' && (
        <BottleFields value={bottle} onChange={setBottle} error={errors.amount} />
      )}
      {kind === 'solids' && <SolidsField value={food} onChange={setFood} error={errors.food} />}

      {running ? (
        <p className="m-0 text-fg-muted">{m.durationAlreadyRunning()}</p>
      ) : (
        <Button tone={durationTone(kind)} size="lg" block className="min-h-16" onClick={startNow}>
          {kind === 'sleep' ? m.sleepStartNow() : m.durationStartTimer()}
        </Button>
      )}

      <form
        noValidate
        onSubmit={logAfterwards}
        className="flex flex-col gap-4 border-t-2 border-border pt-4"
      >
        <h3 className="m-0 font-extrabold">{m.durationAfterwards()}</h3>
        <div className="flex flex-col gap-2">
          <AgoChips
            legend={m.durationStartedWhen()}
            showLegend
            options={STARTED_AGO}
            selected={startedAgo}
            onSelect={(ago) => {
              setStartedAgo(ago)
              setPickedStart(toDateTimeLocal(Date.now() - ago * MINUTE))
            }}
          />
          <TimeField
            label={m.eventStart()}
            value={start}
            onChange={(value) => {
              setPickedStart(value)
              setStartedAgo(null)
            }}
            error={errors.start}
            now={now}
          />
          {pickedStart === null && (
            <p className="m-0 text-caption text-fg-muted">{m.durationStartDerived()}</p>
          )}
        </div>
        {kind === 'breast' ? (
          (['left', 'right'] as const).map((side) => (
            <DurationField
              key={side}
              legend={m.breastSideHowLong({ side: sideLabel[side]() })}
              choices={definition.durations}
              noneLabel={m.breastSideNone()}
              value={sideMinutes[side]}
              onChange={(value) => setSideMinutes((sides) => ({ ...sides, [side]: value }))}
              tone={chipTone}
            />
          ))
        ) : (
          <DurationField
            legend={m.durationHowLong()}
            choices={definition.durations}
            value={minutes}
            onChange={setMinutes}
            tone={chipTone}
          />
        )}
        {errors.duration && <FormError>{errors.duration}</FormError>}
        {kind === 'pumping' && (
          <Input
            label={m.pumpingAmount({ unit: unitLabel('volume') })}
            {...quantityInputProps('volume')}
            min={0}
            value={amount}
            error={errors.amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        )}
        {endsAt !== null && (
          <p className="m-0 text-caption text-fg-muted">
            {m.durationEndsAt({ time: formatTime(endsAt) })}
          </p>
        )}
        {errors.form && <FormError>{errors.form}</FormError>}
        <Button type="submit" variant="soft" tone={durationTone(kind)} block>
          {m.actionSave()}
        </Button>
      </form>
    </div>
  )
}

import { type Event, isRunning, isTimed } from '@bobo/shared'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { inputValue, quantityInputProps, unitLabel } from '../../lib/units'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useMemberName } from '../family/api'
import { type GrowthErrors, growthFieldValue, parseGrowth } from '../growth/growth-input'
import { saveEvent } from './actions'
import { parseBottle } from './bottle-input'
import { type DiaperData, DiaperFields } from './DiaperFields'
import { parseTemperature, parseVolume } from './measure-input'
import { MixedAmounts } from './MixedAmounts'
import { deleteEvent, moveEventStart, setEventNote } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { overlapsSleep, validateTime } from './validation'

type Errors = Partial<
  Record<'start' | 'end' | 'amount' | 'food' | 'celsius' | 'name' | 'note' | 'form', string>
> &
  GrowthErrors

/** Edits any event; changes are applied through the pure helpers in records.ts. */
export function EditEventForm({
  event,
  events,
  onDone,
  onDeleted,
}: {
  event: Event
  events: readonly Event[]
  onDone: () => void
  onDeleted: (event: Event) => void
}) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const readOnly = !useAccess().canEditEvent(event)
  const author = useMemberName(event.familyId, event.createdBy)
  const running = isRunning(event)
  const [start, setStart] = useState(() => toDateTimeLocal(event.startAt))
  const [end, setEnd] = useState(() => (event.endAt === null ? '' : toDateTimeLocal(event.endAt)))
  const [note, setNote] = useState(event.note ?? '')
  const [amount, setAmount] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle'
      ? inputValue('volume', event.data.amountMl)
      : event.type === 'pumping'
        ? inputValue('volume', event.data.amountMl)
        : '',
  )
  const [pumpingSide, setPumpingSide] = useState(() =>
    event.type === 'pumping' ? event.data.side : 'both',
  )
  const [celsius, setCelsius] = useState(() =>
    event.type === 'temperature' ? inputValue('temperature', event.data.celsius) : '',
  )
  const [medName, setMedName] = useState(() => (event.type === 'medication' ? event.data.name : ''))
  const [weight, setWeight] = useState(() =>
    event.type === 'growth' ? growthFieldValue('weight', event.data.weightKg) : '',
  )
  const [length, setLength] = useState(() =>
    event.type === 'growth' ? growthFieldValue('length', event.data.lengthCm) : '',
  )
  const [head, setHead] = useState(() =>
    event.type === 'growth' ? growthFieldValue('length', event.data.headCm) : '',
  )
  const [medDose, setMedDose] = useState(() =>
    event.type === 'medication' ? (event.data.dose ?? '') : '',
  )
  const [milk, setMilk] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle' ? event.data.milk : 'formula',
  )
  const [food, setFood] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'solids' ? event.data.food : '',
  )
  const [diaper, setDiaper] = useState<DiaperData>(() =>
    event.type === 'diaper' ? event.data : { contents: 'wet' },
  )
  const [breastPart, setBreastPart] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle' && event.data.breastMl !== undefined
      ? inputValue('volume', event.data.breastMl)
      : '',
  )
  const [formulaPart, setFormulaPart] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle' && event.data.formulaMl !== undefined
      ? inputValue('volume', event.data.formulaMl)
      : '',
  )
  const [sleepKind, setSleepKind] = useState(() =>
    event.type === 'sleep' ? event.data.kind : 'nap',
  )
  const [errors, setErrors] = useState<Errors>({})
  // Only finished sleeps have an editable end; breastfeed ends follow their segments.
  const editableEnd = event.type === 'sleep' && !running

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (readOnly) return
    const current = Date.now()
    const nextErrors: Errors = {}
    const startResult = validateTime(start, current)
    if ('error' in startResult) nextErrors.start = startResult.error
    const endResult = editableEnd ? validateTime(end, current) : undefined
    if (endResult && 'error' in endResult) nextErrors.end = endResult.error

    let next: Event = event
    if ('at' in startResult) next = moveEventStart(next, startResult.at, current)
    if (next.type === 'sleep') {
      if (endResult && 'at' in endResult && 'at' in startResult) {
        if (endResult.at < startResult.at) nextErrors.end = m.endBeforeStart()
        else next = { ...next, endAt: endResult.at }
      }
      next = { ...next, data: { kind: sleepKind } }
      if (overlapsSleep(events, next.startAt, next.endAt ?? current, current, next.id)) {
        nextErrors.form = m.sleepOverlap()
      }
    }
    if (next.type === 'feeding' && next.data.kind === 'bottle') {
      // Mixed bottles logged before the split existed keep their total until parts are entered.
      const unsplit = milk === 'mixed' && !breastPart.trim() && !formulaPart.trim()
      const bottle = unsplit
        ? parseBottle({ milk: 'formula', amount, breast: '', formula: '' })
        : parseBottle({ milk, amount, breast: breastPart, formula: formulaPart })
      if ('error' in bottle) nextErrors.amount = bottle.error
      else
        next = {
          ...next,
          data: { kind: 'bottle', amountMl: bottle.amountMl, milk, ...bottle.split },
        }
    }
    if (next.type === 'feeding' && next.data.kind === 'solids') {
      if (!food.trim()) nextErrors.food = m.solidsFoodRequired()
      else next = { ...next, data: { kind: 'solids', food: food.trim() } }
    }
    if (next.type === 'diaper') next = { ...next, data: diaper }
    if (next.type === 'pumping') {
      const pumping = parseVolume(amount)
      if ('error' in pumping) nextErrors.amount = pumping.error
      else next = { ...next, data: { side: pumpingSide, amountMl: pumping.amountMl } }
    }
    if (next.type === 'temperature') {
      const temperature = parseTemperature(celsius)
      if ('error' in temperature) nextErrors.celsius = temperature.error
      else next = { ...next, data: { celsius: temperature.celsius } }
    }
    if (next.type === 'medication') {
      if (!medName.trim()) nextErrors.name = m.medicationNameRequired()
      else next = { ...next, data: { name: medName.trim(), dose: medDose.trim() || null } }
    }
    if (next.type === 'note' && !note.trim()) nextErrors.note = m.noteRequired()
    if (next.type === 'growth') {
      const growth = parseGrowth({ weight, length, head })
      if ('errors' in growth) Object.assign(nextErrors, growth.errors)
      else next = { ...next, data: growth.data }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    saveEvent(store, setEventNote(next, note, current))
    onDone()
  }

  function remove() {
    const deleted = deleteEvent(event, Date.now())
    saveEvent(store, deleted)
    onDeleted(deleted)
    onDone()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {author && (
        <p className="m-0 text-caption text-fg-muted">{m.eventAuthor({ name: author })}</p>
      )}
      {readOnly && <p className="m-0 font-bold text-fg-muted">{m.eventReadOnly()}</p>}
      <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        {event.type === 'feeding' && event.data.kind === 'bottle' && (
          <>
            <SegmentedControl
              label={m.bottleMilk()}
              options={[
                { value: 'formula', label: m.milkFormula() },
                { value: 'breast', label: m.milkBreast() },
                { value: 'mixed', label: m.milkMixed() },
              ]}
              value={milk}
              onChange={setMilk}
            />
            {milk === 'mixed' && (breastPart || formulaPart || !amount) ? (
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
                  label={m.bottleAmount({ unit: unitLabel('volume') })}
                  {...quantityInputProps('volume')}
                  value={amount}
                  error={errors.amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {milk === 'mixed' && (
                  <Button
                    variant="ghost"
                    tone="feeding"
                    onClick={() => {
                      setBreastPart('0')
                      setFormulaPart(amount)
                    }}
                  >
                    {m.mixedSplitAction()}
                  </Button>
                )}
              </>
            )}
          </>
        )}
        {event.type === 'feeding' && event.data.kind === 'solids' && (
          <Input
            label={m.solidsFood()}
            value={food}
            maxLength={100}
            error={errors.food}
            onChange={(e) => setFood(e.target.value)}
          />
        )}
        {event.type === 'diaper' && <DiaperFields value={diaper} onChange={setDiaper} />}
        {event.type === 'pumping' && (
          <>
            <SegmentedControl
              label={m.pumpingSide()}
              options={[
                { value: 'left', label: m.sideLeft() },
                { value: 'right', label: m.sideRight() },
                { value: 'both', label: m.pumpingBoth() },
              ]}
              value={pumpingSide}
              onChange={setPumpingSide}
            />
            <Input
              label={m.pumpingAmount({ unit: unitLabel('volume') })}
              {...quantityInputProps('volume')}
              value={amount}
              error={errors.amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </>
        )}
        {event.type === 'growth' && (
          <>
            <Input
              label={m.growthWeight({ unit: unitLabel('weight') })}
              {...quantityInputProps('weight')}
              value={weight}
              error={errors.weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <Input
              label={m.growthLength({ unit: unitLabel('length') })}
              {...quantityInputProps('length')}
              value={length}
              error={errors.length}
              onChange={(e) => setLength(e.target.value)}
            />
            <Input
              label={m.growthHead({ unit: unitLabel('length') })}
              {...quantityInputProps('length')}
              value={head}
              error={errors.head}
              onChange={(e) => setHead(e.target.value)}
            />
          </>
        )}
        {event.type === 'temperature' && (
          <Input
            label={m.temperatureLabel({ unit: unitLabel('temperature') })}
            {...quantityInputProps('temperature')}
            value={celsius}
            error={errors.celsius}
            onChange={(e) => setCelsius(e.target.value)}
          />
        )}
        {event.type === 'medication' && (
          <>
            <Input
              label={m.medicationName()}
              value={medName}
              maxLength={100}
              error={errors.name}
              onChange={(e) => setMedName(e.target.value)}
            />
            <Input
              label={m.medicationDose()}
              placeholder={m.medicationDosePlaceholder()}
              value={medDose}
              maxLength={50}
              onChange={(e) => setMedDose(e.target.value)}
            />
          </>
        )}
        {event.type === 'sleep' && (
          <SegmentedControl
            label={m.sleepKindLabel()}
            options={[
              { value: 'nap', label: m.sleepNap() },
              { value: 'night', label: m.sleepNight() },
            ]}
            value={sleepKind}
            onChange={setSleepKind}
          />
        )}
        <TimeField
          label={isTimed(event) ? m.eventStart() : m.eventTime()}
          value={start}
          onChange={setStart}
          error={errors.start}
          now={now}
        />
        {editableEnd && (
          <TimeField
            label={m.eventEnd()}
            value={end}
            onChange={setEnd}
            error={errors.end}
            now={now}
          />
        )}
        <Input
          label={event.type === 'note' ? m.noteText() : m.eventNote()}
          placeholder={event.type === 'note' ? undefined : m.eventNotePlaceholder()}
          error={errors.note}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </fieldset>
      {errors.form && <p className="font-bold text-danger-text">{errors.form}</p>}
      {!readOnly && (
        <>
          <Button type="submit" size="lg" block>
            {m.actionSave()}
          </Button>
          <Button variant="ghost" tone="danger" onClick={remove}>
            {m.eventDelete()}
          </Button>
        </>
      )}
    </form>
  )
}

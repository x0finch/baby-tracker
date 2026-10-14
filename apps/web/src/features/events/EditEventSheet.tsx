import { type Event, isRunning, isTimed } from '@bobo/shared'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useMemberName } from '../family/api'
import { saveEvent } from './actions'
import { validCelsius, validPumpingMl } from './OtherEventSheet'
import { deleteEvent, moveEventStart, setEventNote } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { overlapsSleep, validateTime } from './validation'

type Errors = Partial<
  Record<'start' | 'end' | 'amount' | 'food' | 'celsius' | 'name' | 'note' | 'form', string>
>

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
      ? String(event.data.amountMl)
      : event.type === 'pumping'
        ? String(event.data.amountMl)
        : '',
  )
  const [pumpingSide, setPumpingSide] = useState(() =>
    event.type === 'pumping' ? event.data.side : 'both',
  )
  const [celsius, setCelsius] = useState(() =>
    event.type === 'temperature' ? String(event.data.celsius) : '',
  )
  const [medName, setMedName] = useState(() => (event.type === 'medication' ? event.data.name : ''))
  const [medDose, setMedDose] = useState(() =>
    event.type === 'medication' ? (event.data.dose ?? '') : '',
  )
  const [milk, setMilk] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle' ? event.data.milk : 'formula',
  )
  const [food, setFood] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'solids' ? event.data.food : '',
  )
  const [contents, setContents] = useState(() =>
    event.type === 'diaper' ? event.data.contents : 'wet',
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
      const amountMl = Number(amount)
      if (!(amountMl > 0 && amountMl <= 1000)) nextErrors.amount = m.bottleAmountInvalid()
      else next = { ...next, data: { kind: 'bottle', amountMl, milk } }
    }
    if (next.type === 'feeding' && next.data.kind === 'solids') {
      if (!food.trim()) nextErrors.food = m.solidsFoodRequired()
      else next = { ...next, data: { kind: 'solids', food: food.trim() } }
    }
    if (next.type === 'diaper') next = { ...next, data: { contents } }
    if (next.type === 'pumping') {
      const amountMl = Number(amount)
      if (!validPumpingMl(amountMl)) nextErrors.amount = m.bottleAmountInvalid()
      else next = { ...next, data: { side: pumpingSide, amountMl } }
    }
    if (next.type === 'temperature') {
      const value = Number(celsius)
      if (!validCelsius(value)) nextErrors.celsius = m.temperatureInvalid()
      else next = { ...next, data: { celsius: Math.round(value * 10) / 10 } }
    }
    if (next.type === 'medication') {
      if (!medName.trim()) nextErrors.name = m.medicationNameRequired()
      else next = { ...next, data: { name: medName.trim(), dose: medDose.trim() || null } }
    }
    if (next.type === 'note' && !note.trim()) nextErrors.note = m.noteRequired()

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
            <Input
              label={m.bottleAmount()}
              type="number"
              inputMode="numeric"
              value={amount}
              error={errors.amount}
              onChange={(e) => setAmount(e.target.value)}
            />
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
        {event.type === 'diaper' && (
          <SegmentedControl
            label={m.diaperContents()}
            options={[
              { value: 'wet', label: m.diaperWet() },
              { value: 'dirty', label: m.diaperDirty() },
              { value: 'mixed', label: m.diaperMixed() },
            ]}
            value={contents}
            onChange={setContents}
          />
        )}
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
              label={m.pumpingAmount()}
              type="number"
              inputMode="numeric"
              value={amount}
              error={errors.amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </>
        )}
        {event.type === 'temperature' && (
          <Input
            label={m.temperatureLabel()}
            type="number"
            inputMode="decimal"
            step="0.1"
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

import { type Event, MINUTE, hasDuration, isRunning } from '@bobo/shared'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { inputValue } from '../../lib/units'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useMemberName } from '../family/collections'
import {
  type GrowthErrors,
  draftFromGrowth,
  emptyGrowth,
  parseGrowth,
} from '../growth/growth-input'
import { saveEvent } from './actions'
import { type DiaperData, DiaperFields } from './DiaperFields'
import {
  draftFromBottle,
  draftFromMedication,
  draftFromPumping,
  emptyBottle,
  emptyMedication,
  emptyPumping,
  parseBottleDraft,
  parseCelsius,
  parseMedication,
  parsePumping,
  parseSolids,
} from './event-draft'
import {
  BottleFields,
  GrowthFields,
  MedicationFields,
  PumpingFields,
  SolidsField,
  TemperatureField,
} from './EventFields'
import { FeedDurationField } from './FeedDurationField'
import { optionsOf, sleepKindLabel } from './labels'
import { deleteEvent, moveEventStart, setEventNote } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
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
  onDeleted?: (event: Event) => void
}) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const readOnly = !useAccess().canEditEvent(event)
  const author = useMemberName(event.familyId, event.createdBy)
  const running = isRunning(event)
  const [start, setStart] = useState(() => toDateTimeLocal(event.startAt))
  const [end, setEnd] = useState(() => (event.endAt === null ? '' : toDateTimeLocal(event.endAt)))
  const [note, setNote] = useState(event.note ?? '')
  const [bottle, setBottle] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'bottle'
      ? draftFromBottle(event.data)
      : emptyBottle,
  )
  const [food, setFood] = useState(() =>
    event.type === 'feeding' && event.data.kind === 'solids' ? event.data.food : '',
  )
  const [pumping, setPumping] = useState(() =>
    event.type === 'pumping' ? draftFromPumping(event.data) : emptyPumping,
  )
  const [celsius, setCelsius] = useState(() =>
    event.type === 'temperature' ? inputValue('temperature', event.data.celsius) : '',
  )
  const [medication, setMedication] = useState(() =>
    event.type === 'medication' ? draftFromMedication(event.data) : emptyMedication,
  )
  const [growth, setGrowth] = useState(() =>
    event.type === 'growth' ? draftFromGrowth(event.data) : emptyGrowth,
  )
  const [diaper, setDiaper] = useState<DiaperData>(() =>
    event.type === 'diaper' ? event.data : { contents: 'wet' },
  )
  // Bottles and solids show how long they took (until #170 brings this to every duration record).
  const feedDuration = event.type === 'feeding' && event.data.kind !== 'breast'
  const [duration, setDuration] = useState<number | null>(() =>
    feedDuration && event.endAt !== null && event.endAt > event.startAt
      ? Math.round((event.endAt - event.startAt) / MINUTE)
      : null,
  )
  const [sleepKind, setSleepKind] = useState(() =>
    event.type === 'sleep' ? event.data.kind : 'nap',
  )
  const [errors, setErrors] = useState<Errors>({})
  // Only finished sleeps have an editable end; breastfeed ends follow their segments.
  const editableEnd = event.type === 'sleep' && !running

  /** The edited record with this form's values, or the field errors. */
  function parseData(current: Event): { event: Event } | { errors: Errors } {
    const result = <D,>(parsed: { data: D } | { errors: Errors }, apply: (data: D) => Event) =>
      'errors' in parsed ? parsed : { event: apply(parsed.data) }
    switch (current.type) {
      case 'feeding':
        if (current.data.kind === 'bottle') {
          return result(parseBottleDraft(bottle, true), (data) => ({ ...current, data }))
        }
        if (current.data.kind === 'solids') {
          return result(parseSolids(food), (data) => ({ ...current, data }))
        }
        return { event: current }
      case 'diaper':
        return { event: { ...current, data: diaper } }
      case 'pumping':
        return result(parsePumping(pumping), (data) => ({ ...current, data }))
      case 'temperature':
        return result(parseCelsius(celsius), (data) => ({ ...current, data }))
      case 'medication':
        return result(parseMedication(medication), (data) => ({ ...current, data }))
      case 'growth':
        return result(parseGrowth(growth), (data) => ({ ...current, data }))
      default:
        return { event: current }
    }
  }

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
        if (endResult.at < startResult.at) nextErrors.end = m.eventEndBeforeStart()
        else next = { ...next, endAt: endResult.at }
      }
      next = { ...next, data: { kind: sleepKind } }
      if (overlapsSleep(events, next.startAt, next.endAt ?? current, current, next.id)) {
        nextErrors.form = m.sleepOverlap()
      }
    }
    const parsed = parseData(next)
    if ('errors' in parsed) Object.assign(nextErrors, parsed.errors)
    else next = parsed.event
    if (feedDuration) {
      const endAt = next.startAt + (duration ?? 0) * MINUTE
      if (endAt > current + MINUTE) nextErrors.start = m.feedEndFuture()
      else next = { ...next, endAt }
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
    onDeleted?.(deleted)
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
          <BottleFields value={bottle} onChange={setBottle} error={errors.amount} editing />
        )}
        {event.type === 'feeding' && event.data.kind === 'solids' && (
          <SolidsField value={food} onChange={setFood} error={errors.food} />
        )}
        {event.type === 'diaper' && <DiaperFields value={diaper} onChange={setDiaper} />}
        {event.type === 'pumping' && (
          <PumpingFields value={pumping} onChange={setPumping} error={errors.amount} />
        )}
        {event.type === 'growth' && (
          <GrowthFields value={growth} onChange={setGrowth} errors={errors} />
        )}
        {event.type === 'temperature' && (
          <TemperatureField value={celsius} onChange={setCelsius} error={errors.celsius} />
        )}
        {event.type === 'medication' && (
          <MedicationFields value={medication} onChange={setMedication} error={errors.name} />
        )}
        {event.type === 'sleep' && (
          <SegmentedControl
            label={m.sleepKindLabel()}
            options={optionsOf(sleepKindLabel, ['nap', 'night'])}
            value={sleepKind}
            onChange={setSleepKind}
          />
        )}
        {feedDuration && <FeedDurationField value={duration} onChange={setDuration} />}
        <TimeField
          label={hasDuration(event) ? m.eventStart() : m.eventTime()}
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
      {errors.form && <FormError>{errors.form}</FormError>}
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

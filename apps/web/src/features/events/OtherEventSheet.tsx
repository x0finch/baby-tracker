import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { addEvent } from './actions'
import { type OtherCategory, categoryTone } from './category'
import { logMedication, logNote, logPumping, logTemperature } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { validateTime } from './validation'

type PumpingSide = 'left' | 'right' | 'both'
type Errors = Partial<Record<'time' | 'amount' | 'celsius' | 'name' | 'text', string>>

/** Plausible body temperatures; the schema allows a wider range for unusual readings. */
export function validCelsius(value: number): boolean {
  return value >= 34 && value <= 43
}

export function validPumpingMl(value: number): boolean {
  return value > 0 && value <= 1000
}

/** Form for the less frequent event types (pumping, temperature, medication, notes). */
export function OtherEventForm({
  category,
  babyId,
  onDone,
}: {
  category: OtherCategory
  babyId: string
  onDone: () => void
}) {
  const store = useLocalStore()
  const now = useNow(60_000)
  const [time, setTime] = useState(() => toDateTimeLocal(now))
  const [side, setSide] = useState<PumpingSide>('both')
  const [amount, setAmount] = useState('')
  const [celsius, setCelsius] = useState('')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    const current = Date.now()
    const next: Errors = {}
    const timeResult = validateTime(time, current)
    if ('error' in timeResult) next.time = timeResult.error
    if (category === 'pumping' && !validPumpingMl(Number(amount))) {
      next.amount = m.bottleAmountInvalid()
    }
    if (category === 'temperature' && !validCelsius(Number(celsius))) {
      next.celsius = m.temperatureInvalid()
    }
    if (category === 'medication' && !name.trim()) next.name = m.medicationNameRequired()
    if (category === 'note' && !text.trim()) next.text = m.noteRequired()
    setErrors(next)
    if (Object.keys(next).length > 0 || !('at' in timeResult)) return

    const at = timeResult.at
    const event =
      category === 'pumping'
        ? logPumping(babyId, at, side, Number(amount), current)
        : category === 'temperature'
          ? logTemperature(babyId, at, Number(celsius), current)
          : category === 'medication'
            ? logMedication(babyId, at, name, dose, current)
            : logNote(babyId, at, text, current)
    addEvent(store, event)
    onDone()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {category === 'pumping' && (
        <>
          <SegmentedControl<PumpingSide>
            label={m.pumpingSide()}
            options={[
              { value: 'left', label: m.sideLeft() },
              { value: 'right', label: m.sideRight() },
              { value: 'both', label: m.pumpingBoth() },
            ]}
            value={side}
            onChange={setSide}
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
      {category === 'temperature' && (
        <Input
          label={m.temperatureLabel()}
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="36.8"
          value={celsius}
          error={errors.celsius}
          onChange={(e) => setCelsius(e.target.value)}
        />
      )}
      {category === 'medication' && (
        <>
          <Input
            label={m.medicationName()}
            value={name}
            maxLength={100}
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={m.medicationDose()}
            placeholder={m.medicationDosePlaceholder()}
            value={dose}
            maxLength={50}
            onChange={(e) => setDose(e.target.value)}
          />
        </>
      )}
      {category === 'note' && (
        <Input
          label={m.noteText()}
          value={text}
          maxLength={500}
          error={errors.text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      <TimeField
        label={m.eventTime()}
        value={time}
        onChange={setTime}
        error={errors.time}
        now={now}
      />
      <Button type="submit" tone={categoryTone[category]} size="lg" block>
        {m.actionLog()}
      </Button>
    </form>
  )
}

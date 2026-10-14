import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useLocalStore } from '../../db'
import { inputValue, quantityInputProps, unitLabel } from '../../lib/units'
import { m } from '../../paraglide/messages.js'
import { type GrowthErrors, parseGrowth } from '../growth/growth-input'
import { addEvent } from './actions'
import { type OtherCategory, categoryTone } from './category'
import { parseTemperature, parseVolume } from './measure-input'
import { logGrowth, logMedication, logNote, logPumping, logTemperature } from './records'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'
import { useNow } from './use-events'
import { validateTime } from './validation'

type PumpingSide = 'left' | 'right' | 'both'
type Errors = Partial<Record<'time' | 'amount' | 'celsius' | 'name' | 'text', string>> &
  GrowthErrors

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
  const [weight, setWeight] = useState('')
  const [length, setLength] = useState('')
  const [head, setHead] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    const current = Date.now()
    const next: Errors = {}
    const timeResult = validateTime(time, current)
    if ('error' in timeResult) next.time = timeResult.error
    const pumping = category === 'pumping' ? parseVolume(amount) : undefined
    if (pumping && 'error' in pumping) next.amount = pumping.error
    const temperature = category === 'temperature' ? parseTemperature(celsius) : undefined
    if (temperature && 'error' in temperature) next.celsius = temperature.error
    if (category === 'medication' && !name.trim()) next.name = m.medicationNameRequired()
    if (category === 'note' && !text.trim()) next.text = m.noteRequired()
    const growth = category === 'growth' ? parseGrowth({ weight, length, head }) : undefined
    if (growth && 'errors' in growth) Object.assign(next, growth.errors)
    setErrors(next)
    if (Object.keys(next).length > 0 || !('at' in timeResult)) return

    const at = timeResult.at
    const event =
      growth && 'data' in growth
        ? logGrowth(babyId, at, growth.data, current)
        : pumping && 'amountMl' in pumping
          ? logPumping(babyId, at, side, pumping.amountMl, current)
          : temperature && 'celsius' in temperature
            ? logTemperature(babyId, at, temperature.celsius, current)
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
            label={m.pumpingAmount({ unit: unitLabel('volume') })}
            {...quantityInputProps('volume')}
            value={amount}
            error={errors.amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </>
      )}
      {category === 'growth' && (
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
          {errors.form && <p className="m-0 font-bold text-danger-text">{errors.form}</p>}
        </>
      )}
      {category === 'temperature' && (
        <Input
          label={m.temperatureLabel({ unit: unitLabel('temperature') })}
          {...quantityInputProps('temperature')}
          placeholder={inputValue('temperature', 36.8)}
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

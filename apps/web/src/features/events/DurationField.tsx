import { MINUTE } from '@bobo/shared'
import { useState } from 'react'

import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { type ChipTone, ChipGroup } from '../../components/ui/ToggleChip'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'

type Choice = number | 'custom'

/**
 * How long something took: quick choices in minutes, or any number of minutes. With
 * `noneLabel`, a first choice of 0 for "not at all" (a breast side not fed).
 */
export function DurationField({
  legend,
  choices,
  value,
  onChange,
  noneLabel,
  tone,
  error,
}: {
  legend: string
  choices: readonly number[]
  value: number | null
  onChange: (minutes: number | null) => void
  noneLabel?: string
  tone?: ChipTone
  error?: string
}) {
  const quick = noneLabel === undefined ? choices : [0, ...choices]
  const [custom, setCustom] = useState(value !== null && !quick.includes(value))
  const [typed, setTyped] = useState(custom && value !== null ? String(value) : '')
  return (
    <div className="flex flex-col gap-2">
      <ChipGroup<Choice>
        legend={legend}
        options={[...quick, 'custom']}
        value={custom ? 'custom' : value}
        onChange={(choice) => {
          setCustom(choice === 'custom')
          if (choice === 'custom') {
            const minutes = Number.parseInt(typed, 10)
            onChange(minutes > 0 ? minutes : null)
          } else onChange(choice)
        }}
        optionLabel={(choice) =>
          choice === 'custom'
            ? m.durationCustom()
            : choice === 0 && noneLabel !== undefined
              ? noneLabel
              : durationLabel(choice * MINUTE)
        }
        tone={tone}
      />
      {custom && (
        <Input
          label={m.durationCustomMinutes()}
          type="number"
          inputMode="numeric"
          min={1}
          max={24 * 60}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
            const minutes = Number.parseInt(event.target.value, 10)
            onChange(minutes > 0 ? minutes : null)
          }}
        />
      )}
      {error && <FormError>{error}</FormError>}
    </div>
  )
}

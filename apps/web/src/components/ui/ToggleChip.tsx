import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

import { popElement } from '../../lib/motion'

export type ChipTone = 'primary' | 'feeding' | 'diaper'

const pressedTones: Record<ChipTone, { box: string; text: string }> = {
  primary: { box: 'border-primary bg-primary-soft', text: 'text-primary-text' },
  feeding: { box: 'border-feeding bg-feeding-soft', text: 'text-feeding-text' },
  diaper: { box: 'border-diaper bg-diaper-soft', text: 'text-diaper-text' },
}

export interface ToggleChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  tone?: ChipTone
  /** Color the label by state (muted when off, the tone when on); off for picture cards. */
  tintText?: boolean
}

/** On/off button with the flat pressed edge; `aria-pressed` carries the state. */
export function ToggleChip({
  pressed,
  tone = 'primary',
  tintText = true,
  type = 'button',
  className,
  onClick,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      onClick={(event) => {
        if (!pressed) popElement(event.currentTarget)
        onClick?.(event)
      }}
      className={clsx(
        'press border-2 border-b-4',
        pressed ? pressedTones[tone].box : 'border-border bg-surface',
        tintText && (pressed ? pressedTones[tone].text : 'text-fg-muted'),
        className,
      )}
      {...props}
    />
  )
}

export interface ChipGroupProps<T> {
  legend: string
  /** Visually hidden legends still name the group for screen readers. */
  showLegend?: boolean
  options: readonly T[]
  value: T | null
  onChange: (value: T) => void
  optionLabel: (value: T) => string
  tone?: ChipTone
}

/** Single-choice chips in a three-column grid, for quick picks like "5 分钟前". */
export function ChipGroup<T extends string | number | null>({
  legend,
  showLegend = true,
  options,
  value,
  onChange,
  optionLabel,
  tone,
}: ChipGroupProps<T>) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={showLegend ? 'mb-1.5 p-0 font-bold' : 'sr-only'}>{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <ToggleChip
            key={String(option)}
            pressed={value === option}
            tone={tone}
            onClick={() => onChange(option)}
            className="min-h-11 rounded-lg font-extrabold"
          >
            {optionLabel(option)}
          </ToggleChip>
        ))}
      </div>
    </fieldset>
  )
}

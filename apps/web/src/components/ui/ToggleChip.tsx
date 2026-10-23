import { clsx } from 'clsx'
import { type ButtonHTMLAttributes, useEffect, useId, useRef } from 'react'

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

/**
 * Single-choice chips in one row that scrolls sideways, for quick picks like "5 分钟前". About
 * three and a half fit, so the cut-off chip on the right shows there are more. Native radio
 * buttons underneath give the group its name, arrow keys and one tab stop.
 */
export function ChipGroup<T extends string | number | null>({
  legend,
  showLegend = true,
  options,
  value,
  onChange,
  optionLabel,
  tone = 'primary',
}: ChipGroupProps<T>) {
  const name = useId()
  const row = useRef<HTMLDivElement>(null)
  // A choice made earlier (editing a record) may sit past the visible chips: show it.
  useEffect(() => {
    const list = row.current
    const chosen = list?.querySelector<HTMLElement>('label:has(input:checked)')
    if (!list || !chosen) return
    const overflow = chosen.offsetLeft + chosen.offsetWidth - list.clientWidth
    if (overflow > 0) list.scrollLeft = overflow + chosen.offsetWidth / 2
  }, [])
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={showLegend ? 'mb-1.5 p-0 font-bold' : 'sr-only'}>{legend}</legend>
      <div ref={row} className="relative flex snap-x gap-2 overflow-x-auto pb-1">
        {options.map((option) => {
          const checked = value === option
          return (
            <label
              key={String(option)}
              className={clsx(
                'press flex min-h-11 w-[28%] shrink-0 snap-start items-center justify-center rounded-lg border-2 border-b-4 px-1 text-center font-extrabold whitespace-nowrap',
                'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-diaper',
                checked
                  ? [pressedTones[tone].box, pressedTones[tone].text]
                  : 'border-border bg-surface text-fg-muted',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                // Click, not change: picking the chosen chip again still counts ("5 分钟前" from now).
                onClick={(event) => {
                  const chip = event.currentTarget.parentElement
                  if (!checked && chip) popElement(chip)
                  onChange(option)
                }}
                onChange={() => undefined}
              />
              {optionLabel(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

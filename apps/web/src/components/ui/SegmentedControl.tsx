import { clsx } from 'clsx'
import { useId } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Single-choice toggle (e.g. left/right breast, nap/night). Built on native radio
 * inputs, so arrow-key navigation and screen reader semantics come for free.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId()

  return (
    <fieldset className="m-0 flex min-w-0 gap-1 rounded-lg border-2 border-border bg-surface p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={clsx(
            'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md font-extrabold transition-colors',
            'has-checked:bg-bg has-checked:text-diaper-text has-checked:shadow-[0_2px_0_var(--bobo-border)]',
            'text-fg-muted has-focus-visible:outline-3 has-focus-visible:outline-diaper',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

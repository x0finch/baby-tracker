import { clsx } from 'clsx'

import { m } from '../../paraglide/messages.js'

/** Quick choices for how long a bottle or solids feed took, in minutes. */
export const FEED_DURATIONS = [5, 10, 15, 20, 30] as const

/** Optional duration chips; `null` means not recorded. */
export function FeedDurationField({
  value,
  onChange,
  hint,
}: {
  value: number | null
  onChange: (minutes: number | null) => void
  hint?: string
}) {
  // An edited record may carry a duration that isn't one of the quick choices.
  const choices: (number | null)[] = [null, ...FEED_DURATIONS]
  if (value !== null && !choices.includes(value)) choices.push(value)
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 font-bold">{m.feedDuration()}</legend>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((minutes) => {
          const selected = value === minutes
          return (
            <button
              key={minutes ?? 'none'}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(minutes)}
              className={clsx(
                'min-h-11 rounded-lg border-2 border-b-4 font-extrabold',
                'transition-[transform,border-width] duration-75 active:translate-y-0.5 active:border-b-2',
                selected
                  ? 'border-feeding bg-feeding-soft text-feeding-text'
                  : 'border-border bg-surface text-fg-muted',
              )}
            >
              {minutes === null ? m.feedDurationNone() : m.feedDurationMinutes({ minutes })}
            </button>
          )
        })}
      </div>
      {hint && <p className="m-0 text-caption text-fg-muted">{hint}</p>}
    </fieldset>
  )
}

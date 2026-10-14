import { clsx } from 'clsx'
import { useState } from 'react'

import { m } from '../../paraglide/messages.js'
import { toDateTimeLocal } from './time'
import { TimeField } from './TimeField'

const MINUTE = 60_000

/** One-tap "how long ago" choices, in minutes; 0 is "just now". */
const AGO = [0, 5, 15, 30, 60, 120] as const

const agoLabel = (minutes: number) =>
  minutes === 0
    ? m.timeJustNow()
    : minutes < 60
      ? m.timeMinutesAgo({ minutes })
      : m.timeHoursAgo({ hours: minutes / 60 })

/**
 * A time field with "刚刚 / 5 分钟前 / …" shortcuts for logging after the fact. `onChange` also
 * reports which shortcut set the time, or null once the time is edited by hand.
 */
export function QuickTimeField({
  label,
  value,
  onChange,
  error,
  now,
}: {
  label: string
  value: string
  onChange: (value: string, minutesAgo: number | null) => void
  error?: string
  now: number
}) {
  const [selected, setSelected] = useState<number | null>(0)
  return (
    <div className="flex flex-col gap-2">
      <TimeField
        label={label}
        value={value}
        onChange={(next) => {
          setSelected(null)
          onChange(next, null)
        }}
        error={error}
        now={now}
      />
      <fieldset className="m-0 grid grid-cols-3 gap-2 border-0 p-0">
        <legend className="sr-only">{m.timeShortcuts()}</legend>
        {AGO.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={selected === minutes}
            onClick={() => {
              setSelected(minutes)
              onChange(toDateTimeLocal(Date.now() - minutes * MINUTE), minutes)
            }}
            className={clsx(
              'min-h-11 rounded-lg border-2 border-b-4 font-bold',
              'transition-[transform,border-width] duration-75 active:translate-y-0.5 active:border-b-2',
              selected === minutes
                ? 'border-primary bg-primary-soft text-primary-text'
                : 'border-border bg-surface text-fg-muted',
            )}
          >
            {agoLabel(minutes)}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

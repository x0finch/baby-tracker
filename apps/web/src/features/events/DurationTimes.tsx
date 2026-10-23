import { type BreastSide, MINUTE, RECORD_KINDS } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'
import { DurationField } from './DurationField'
import { type DurationKind, durationChipTone } from './kinds'
import { sideLabel } from './labels'
import { fromDateTimeLocal, toDateTimeLocal } from './time'
import { TimeField } from './TimeField'

/** When a finished duration record started and how long it took (per side for breastfeeds). */
export interface DurationTimesValue {
  start: string
  /** Null when how long it took wasn't recorded. */
  minutes: number | null
  sides: Record<BreastSide, number | null>
}

export function totalMinutes(kind: DurationKind, value: DurationTimesValue): number | null {
  if (kind !== 'breast') return value.minutes
  const total = (value.sides.left ?? 0) + (value.sides.right ?? 0)
  return total > 0 ? total : null
}

/**
 * Start, duration and end, kept in step: a new start keeps the duration and moves the end; a
 * new duration or end changes the other. Breastfeeds take minutes per side; a new end changes
 * the side fed last.
 */
export function DurationTimes({
  kind,
  value,
  onChange,
  firstSide,
  now,
  errors,
}: {
  kind: DurationKind
  value: DurationTimesValue
  onChange: (value: DurationTimesValue) => void
  /** The side a breastfeed began on. */
  firstSide: BreastSide
  now: number
  errors: { start?: string; end?: string }
}) {
  const definition = RECORD_KINDS[kind]
  const tone = durationChipTone(kind)
  const total = totalMinutes(kind, value)
  const startAt = fromDateTimeLocal(value.start)
  const end =
    total !== null && !Number.isNaN(startAt) ? toDateTimeLocal(startAt + total * MINUTE) : ''

  function setEnd(next: string) {
    const endAt = fromDateTimeLocal(next)
    if (Number.isNaN(endAt) || Number.isNaN(startAt)) return
    const minutes = Math.max(0, Math.round((endAt - startAt) / MINUTE))
    if (kind !== 'breast') {
      onChange({ ...value, minutes: minutes > 0 ? minutes : null })
      return
    }
    const other: BreastSide = firstSide === 'left' ? 'right' : 'left'
    const last = (value.sides[other] ?? 0) > 0 ? other : firstSide
    const kept = last === firstSide ? 0 : (value.sides[firstSide] ?? 0)
    onChange({ ...value, sides: { ...value.sides, [last]: Math.max(0, minutes - kept) } })
  }

  return (
    <div className="flex flex-col gap-4">
      <TimeField
        label={m.eventStart()}
        value={value.start}
        onChange={(start) => onChange({ ...value, start })}
        error={errors.start}
        now={now}
      />
      {kind === 'breast' ? (
        (['left', 'right'] as const).map((side) => (
          <DurationField
            key={side}
            legend={m.breastSideHowLong({ side: sideLabel[side]() })}
            choices={definition.durations}
            noneLabel={m.breastSideNone()}
            value={value.sides[side]}
            onChange={(minutes) =>
              onChange({ ...value, sides: { ...value.sides, [side]: minutes } })
            }
            tone={tone}
          />
        ))
      ) : (
        <DurationField
          legend={m.durationHowLong()}
          choices={definition.durations}
          value={value.minutes}
          onChange={(minutes) => onChange({ ...value, minutes })}
          tone={tone}
        />
      )}
      {total === null ? (
        <p className="m-0 text-caption text-fg-muted">{m.durationNotRecorded()}</p>
      ) : (
        <TimeField
          label={m.eventEnd()}
          value={end}
          onChange={setEnd}
          error={errors.end}
          now={now}
        />
      )}
    </div>
  )
}

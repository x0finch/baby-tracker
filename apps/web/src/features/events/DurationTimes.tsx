import { RECORD_KINDS } from '@bobo/shared'
import type { Dispatch } from 'react'

import { FormError } from '../../components/ui/FormError'
import { m } from '../../paraglide/messages.js'
import { type DurationTimes, type DurationTimesAction, resolveTimes } from './duration-times'
import { DurationField } from './DurationField'
import { durationChipTone } from './kinds'
import { sideLabel } from './labels'
import { AgoChips } from './QuickTimeField'
import { TimeRow } from './TimeRow'

/** "How long ago it started" choices, in minutes. */
const STARTED_AGO = [5, 15, 30, 60, 120, 180] as const

/**
 * Start, duration and end of a duration record, changed only through `timesReducer`. With
 * `quickStart`, "N 分钟前" choices for the start (logging afterwards).
 */
export function DurationTimesFields({
  times,
  dispatch,
  now,
  errors,
  quickStart = false,
}: {
  times: DurationTimes
  dispatch: Dispatch<DurationTimesAction>
  now: number
  errors: { start?: string; end?: string; duration?: string }
  quickStart?: boolean
}) {
  const definition = RECORD_KINDS[times.kind]
  const tone = durationChipTone(times.kind)
  const { startAt, endAt } = resolveTimes(times, now)

  return (
    <div className="flex flex-col gap-4">
      {quickStart && (
        <AgoChips
          legend={m.durationStartedWhen()}
          showLegend
          options={STARTED_AGO}
          selected={times.startedAgo}
          onSelect={(minutes) => dispatch({ type: 'startedAgo', minutes, now: Date.now() })}
        />
      )}
      <div className="flex flex-col gap-1">
        <TimeRow
          label={m.eventStart()}
          at={startAt}
          onChange={(at) => dispatch({ type: 'start', at })}
          now={now}
          error={errors.start}
        />
        {times.startAt === null && (
          <p className="m-0 text-caption text-fg-muted">{m.durationStartDerived()}</p>
        )}
      </div>
      {times.kind === 'breast' ? (
        (['left', 'right'] as const).map((side) => (
          <DurationField
            key={side}
            legend={m.breastSideHowLong({ side: sideLabel[side]() })}
            choices={definition.durations}
            noneLabel={m.breastSideNone()}
            value={times.sides[side]}
            onChange={(minutes) => dispatch({ type: 'side', side, minutes })}
            tone={tone}
          />
        ))
      ) : (
        <DurationField
          legend={m.durationHowLong()}
          choices={definition.durations}
          value={times.minutes}
          onChange={(minutes) => dispatch({ type: 'minutes', minutes })}
          tone={tone}
          error={errors.duration}
        />
      )}
      {times.kind === 'breast' && errors.duration && <FormError>{errors.duration}</FormError>}
      <TimeRow
        label={m.eventEnd()}
        at={endAt}
        onChange={(at) => dispatch({ type: 'end', at, now: Date.now() })}
        now={now}
        error={errors.end}
      />
    </div>
  )
}

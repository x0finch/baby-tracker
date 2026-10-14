import type { Baby, Event } from '@bobo/shared'

import { Card } from '../../components/ui/Card'
import { formatTime } from '../../lib/i18n'
import { useNow } from '../../lib/use-now'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'
import { predictNextSleep } from './nap-prediction'

/** Suggested time for the next sleep; hidden while the baby sleeps. */
export function NapPrediction({ baby, events }: { baby: Baby; events: readonly Event[] }) {
  const now = useNow(60_000)
  const next = predictNextSleep(events, baby.birthDate, now)
  if (next.status === 'sleeping') return null

  return (
    <Card
      as="section"
      tone="sleep"
      aria-labelledby="nap-title"
      className="flex flex-col gap-1 py-3"
    >
      <h2 id="nap-title" className="m-0 text-caption font-bold text-sleep-text">
        {m.napTitle()}
      </h2>
      {next.status === 'unknown' ? (
        <p className="m-0 text-fg-muted">{m.napUnknown()}</p>
      ) : (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3">
            <span className="text-title font-extrabold tabular-nums">
              {m.napWindow({ from: formatTime(next.from), to: formatTime(next.to) })}
            </span>
            <span className="font-bold text-sleep-text">
              {now < next.from
                ? m.napUpcoming({ duration: durationLabel(next.from - now) })
                : now <= next.to
                  ? m.napNow()
                  : m.napLate()}
            </span>
          </p>
          <p className="m-0 text-caption text-fg-muted">
            {next.personalized ? m.napBasisHistory() : m.napBasisAge()}
          </p>
        </>
      )}
    </Card>
  )
}

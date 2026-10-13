import type { Event } from '@bobo/shared'

import { formatNumber } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'
import { summarizeDay } from './summary'

export function DaySummaryCards({
  events,
  dayStart,
  dayEnd,
  now,
}: {
  events: readonly Event[]
  dayStart: number
  dayEnd: number
  now: number
}) {
  const s = summarizeDay(events, dayStart, dayEnd, now)
  const diaperCount = s.diapers.wet + s.diapers.dirty + s.diapers.mixed
  const cards = [
    {
      title: m.categoryFeeding(),
      value: m.summaryFeedCount({ count: s.feedings }),
      details: [
        m.summaryBottle({ amount: formatNumber(s.bottleMl) }),
        m.summaryBreast({ duration: durationLabel(s.breastMs) }),
      ],
      accent: 'border-feeding/40 bg-feeding-soft text-feeding-text',
    },
    {
      title: m.categorySleep(),
      value: m.summarySleepTotal({ duration: durationLabel(s.sleepMs) }),
      details: [
        m.summaryNaps({ count: s.naps }),
        m.summaryLongest({ duration: durationLabel(s.longestSleepMs) }),
      ],
      accent: 'border-sleep/40 bg-sleep-soft text-sleep-text',
    },
    {
      title: m.categoryDiaper(),
      value: m.summaryDiaperCount({ count: diaperCount }),
      details: [m.summaryDiaperDetail(s.diapers)],
      accent: 'border-diaper/40 bg-diaper-soft text-diaper-text',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <section
          key={card.title}
          className={`flex flex-col gap-1 rounded-xl border-2 border-b-4 p-4 ${card.accent}`}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-title font-extrabold">{card.title}</h2>
            <span className="text-title font-extrabold text-fg">{card.value}</span>
          </div>
          {card.details.map((detail) => (
            <p key={detail} className="m-0 text-fg-muted">
              {detail}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

import { type Event, breastSideDurations, eventDurationMs, isRunning } from '@bobo/shared'

import { formatNumber } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'

export type Category = Event['type']

const milkLabels = { breast: m.milkBreast, formula: m.milkFormula, mixed: m.milkMixed }
const diaperLabels = { wet: m.diaperWet, dirty: m.diaperDirty, mixed: m.diaperMixed }

/** Title and one-line detail for an event in lists and the timeline. */
export function describeEvent(event: Event, now: number): { title: string; detail: string } {
  const running = isRunning(event)
  switch (event.type) {
    case 'feeding': {
      const data = event.data
      if (data.kind === 'breast') {
        const sides = breastSideDurations(data.segments, now)
        return {
          title: m.feedingBreast(),
          detail: running
            ? m.inProgress()
            : m.breastDetail({
                left: durationLabel(sides.left),
                right: durationLabel(sides.right),
              }),
        }
      }
      if (data.kind === 'bottle') {
        return {
          title: m.feedingBottle(),
          detail: m.bottleDetail({
            amount: formatNumber(data.amountMl),
            milk: milkLabels[data.milk](),
          }),
        }
      }
      return { title: m.feedingSolids(), detail: data.food }
    }
    case 'sleep':
      return {
        title: event.data.kind === 'night' ? m.sleepNight() : m.sleepNap(),
        detail: running ? m.inProgress() : durationLabel(eventDurationMs(event, now)),
      }
  }
  return { title: m.categoryDiaper(), detail: diaperLabels[event.data.contents]() }
}

import { type Event, breastSideDurations, eventDurationMs, isRunning } from '@bobo/shared'

import { formatNumber } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { durationLabel } from './duration-label'

export type Category = Event['type']

export const categoryTitle: Record<Category, () => string> = {
  feeding: m.categoryFeeding,
  sleep: m.categorySleep,
  diaper: m.categoryDiaper,
  pumping: m.categoryPumping,
  temperature: m.categoryTemperature,
  medication: m.categoryMedication,
  note: m.categoryNote,
}

/** At or above this a temperature is shown as a fever. */
export const FEVER_CELSIUS = 38

const pumpingSides = { left: m.sideLeft, right: m.sideRight, both: m.pumpingBoth }

export function formatCelsius(celsius: number): string {
  return formatNumber(celsius, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

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
    case 'diaper':
      return { title: m.categoryDiaper(), detail: diaperLabels[event.data.contents]() }
    case 'pumping':
      return {
        title: m.categoryPumping(),
        detail: m.pumpingDetail({
          side: pumpingSides[event.data.side](),
          amount: formatNumber(event.data.amountMl),
        }),
      }
    case 'temperature': {
      const value = m.temperatureDetail({ value: formatCelsius(event.data.celsius) })
      return {
        title: m.categoryTemperature(),
        detail: event.data.celsius >= FEVER_CELSIUS ? `${value} · ${m.temperatureFever()}` : value,
      }
    }
    case 'medication':
      return {
        title: m.categoryMedication(),
        detail: event.data.dose ? `${event.data.name} · ${event.data.dose}` : event.data.name,
      }
    case 'note':
      return { title: m.categoryNote(), detail: event.note ?? '' }
    default:
      return event satisfies never
  }
}

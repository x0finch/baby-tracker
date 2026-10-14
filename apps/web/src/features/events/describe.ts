import { type Event, breastSideDurations, eventDurationMs, isRunning } from '@bobo/shared'

import { formatQuantity, unitLabel } from '../../lib/units'
import { m } from '../../paraglide/messages.js'
import { amountLabel, poopColorLabel, poopConsistencyLabel } from './diaper-labels'
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
  growth: m.categoryGrowth,
}

/** At or above this a temperature is shown as a fever. */
export const FEVER_CELSIUS = 38

const pumpingSides = { left: m.sideLeft, right: m.sideRight, both: m.pumpingBoth }

export function growthDetail(data: {
  weightKg: number | null
  lengthCm: number | null
  headCm: number | null
}): string {
  return [
    data.weightKg !== null &&
      m.growthWeightValue({
        value: formatQuantity('weight', data.weightKg),
        unit: unitLabel('weight'),
      }),
    data.lengthCm !== null &&
      m.growthLengthValue({
        value: formatQuantity('length', data.lengthCm),
        unit: unitLabel('length'),
      }),
    data.headCm !== null &&
      m.growthHeadValue({
        value: formatQuantity('length', data.headCm),
        unit: unitLabel('length'),
      }),
  ]
    .filter((part) => typeof part === 'string')
    .join(' · ')
}

/** A temperature in the preferred unit, e.g. "37.5 °C". */
export function temperatureText(celsius: number): string {
  return m.temperatureDetail({
    value: formatQuantity('temperature', celsius),
    unit: unitLabel('temperature'),
  })
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
          detail:
            data.breastMl !== undefined && data.formulaMl !== undefined
              ? m.bottleSplitDetail({
                  amount: formatQuantity('volume', data.amountMl),
                  breast: formatQuantity('volume', data.breastMl),
                  formula: formatQuantity('volume', data.formulaMl),
                  unit: unitLabel('volume'),
                })
              : m.bottleDetail({
                  amount: formatQuantity('volume', data.amountMl),
                  unit: unitLabel('volume'),
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
    case 'diaper': {
      const { contents, pee, poop } = event.data
      const parts: string[] = [diaperLabels[contents]()]
      if (pee) parts.push(m.peeAmountDetail({ amount: amountLabel[pee.amount]() }))
      if (poop) {
        parts.push(
          poopColorLabel[poop.color](),
          poopConsistencyLabel[poop.consistency](),
          m.poopAmountDetail({ amount: amountLabel[poop.amount]() }),
        )
      }
      return { title: m.categoryDiaper(), detail: parts.join(' · ') }
    }
    case 'pumping':
      return {
        title: m.categoryPumping(),
        detail: m.pumpingDetail({
          side: pumpingSides[event.data.side](),
          amount: formatQuantity('volume', event.data.amountMl),
          unit: unitLabel('volume'),
        }),
      }
    case 'temperature': {
      const value = temperatureText(event.data.celsius)
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
    case 'growth':
      return { title: m.categoryGrowth(), detail: growthDetail(event.data) }
    default:
      return event satisfies never
  }
}

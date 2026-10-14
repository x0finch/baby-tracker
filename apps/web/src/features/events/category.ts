import type { Event } from '@bobo/shared'

import type { ButtonTone } from '../../components/ui/Button'
import { m } from '../../paraglide/messages.js'

/** One per event type; the unit for titles, colors, icons and timeline lanes. */
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

// Colors are full class names so Tailwind can find them; keep these maps side by side.
// Buttons only come in the main tones, so the less frequent types borrow one.
export const categoryTone: Record<Category, ButtonTone> = {
  feeding: 'feeding',
  sleep: 'sleep',
  diaper: 'diaper',
  pumping: 'feeding',
  temperature: 'danger',
  medication: 'primary',
  note: 'primary',
  growth: 'primary',
}

/** Fill of a type's icon badge and timeline dot. */
export const categoryDot: Record<Category, string> = {
  feeding: 'bg-feeding',
  sleep: 'bg-sleep',
  diaper: 'bg-diaper',
  pumping: 'bg-avatar-pink',
  temperature: 'bg-danger',
  medication: 'bg-avatar-yellow',
  note: 'bg-fg-muted',
  growth: 'bg-primary',
}

/** Event types logged from the "more" sheet rather than the three big buttons. */
export const OTHER_CATEGORIES = ['growth', 'pumping', 'temperature', 'medication', 'note'] as const
export type OtherCategory = (typeof OTHER_CATEGORIES)[number]

/** Timeline lane for each type; the less frequent types share one lane. */
export type Lane = 'feeding' | 'sleep' | 'diaper' | 'other'
export function laneOf(category: Category): Lane {
  return category === 'feeding' || category === 'sleep' || category === 'diaper'
    ? category
    : 'other'
}

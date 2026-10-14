import type { ButtonTone } from '../../components/ui/Button'
import type { Category } from './describe'

export const categoryTone: Record<Category, ButtonTone> = {
  feeding: 'feeding',
  sleep: 'sleep',
  diaper: 'diaper',
  pumping: 'feeding',
  temperature: 'danger',
  medication: 'primary',
  note: 'primary',
}

export const categoryDot: Record<Category, string> = {
  feeding: 'bg-feeding',
  sleep: 'bg-sleep',
  diaper: 'bg-diaper',
  pumping: 'bg-feeding',
  temperature: 'bg-danger',
  medication: 'bg-primary',
  note: 'bg-fg-muted',
}

/** Event types logged from the "more" sheet rather than the three big buttons. */
export const OTHER_CATEGORIES = ['pumping', 'temperature', 'medication', 'note'] as const
export type OtherCategory = (typeof OTHER_CATEGORIES)[number]

/** Timeline lane for each type; the less frequent types share one lane. */
export type Lane = 'feeding' | 'sleep' | 'diaper' | 'other'
export function laneOf(category: Category): Lane {
  return category === 'feeding' || category === 'sleep' || category === 'diaper'
    ? category
    : 'other'
}

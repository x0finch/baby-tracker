import type { ButtonTone } from '../../components/ui/Button'
import type { Category } from './describe'

export const categoryTone: Record<Category, ButtonTone> = {
  feeding: 'feeding',
  sleep: 'sleep',
  diaper: 'diaper',
}

export const categoryDot: Record<Category, string> = {
  feeding: 'bg-feeding',
  sleep: 'bg-sleep',
  diaper: 'bg-diaper',
}

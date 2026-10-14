import type { GrowthEvent } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'

export type GrowthErrors = Partial<Record<'weight' | 'length' | 'head' | 'form', string>>

const RANGES = {
  weight: { min: 0.3, max: 40, message: m.growthWeightInvalid },
  length: { min: 20, max: 130, message: m.growthLengthInvalid },
  head: { min: 15, max: 60, message: m.growthHeadInvalid },
} as const

/** Parses the three optional measurement fields; at least one must be filled in. */
export function parseGrowth(input: {
  weight: string
  length: string
  head: string
}): { data: GrowthEvent['data'] } | { errors: GrowthErrors } {
  const errors: GrowthErrors = {}
  const read = (field: keyof typeof RANGES): number | null => {
    const raw = input[field].trim()
    if (raw === '') return null
    const value = Number(raw)
    const range = RANGES[field]
    if (!(value >= range.min && value <= range.max)) {
      errors[field] = range.message()
      return null
    }
    return Math.round(value * 100) / 100
  }
  const data = { weightKg: read('weight'), lengthCm: read('length'), headCm: read('head') }
  if (Object.keys(errors).length > 0) return { errors }
  if (data.weightKg === null && data.lengthCm === null && data.headCm === null) {
    return { errors: { form: m.growthRequired() } }
  }
  return { data }
}

export const growthFieldValue = (value: number | null) => (value === null ? '' : String(value))

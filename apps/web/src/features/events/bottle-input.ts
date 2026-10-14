import { m } from '../../paraglide/messages.js'

export type Milk = 'breast' | 'formula' | 'mixed'

export interface BottleInput {
  milk: Milk
  /** Total, used unless the milk is mixed. */
  amount: string
  /** Parts, used when the milk is mixed. */
  breast: string
  formula: string
}

export type ParsedBottle =
  | { amountMl: number; split?: { breastMl: number; formulaMl: number } }
  | { error: string }

const part = (value: string) => (value.trim() === '' ? 0 : Number(value))

/** Mixed bottles take breast milk and formula separately; the total is their sum. */
export function parseBottle(input: BottleInput): ParsedBottle {
  if (input.milk !== 'mixed') {
    const amountMl = Number(input.amount)
    return amountMl > 0 && amountMl <= 1000 ? { amountMl } : { error: m.bottleAmountInvalid() }
  }
  const breastMl = part(input.breast)
  const formulaMl = part(input.formula)
  const amountMl = breastMl + formulaMl
  const valid =
    Number.isFinite(amountMl) && breastMl >= 0 && formulaMl >= 0 && amountMl > 0 && amountMl <= 1000
  return valid ? { amountMl, split: { breastMl, formulaMl } } : { error: m.mixedInvalid() }
}

/** Live total shown under the two mixed fields. */
export function mixedTotal(input: Pick<BottleInput, 'breast' | 'formula'>): number {
  const total = part(input.breast) + part(input.formula)
  return Number.isFinite(total) ? total : 0
}

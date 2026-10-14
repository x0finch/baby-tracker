import type { PoopDetails } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'

export const poopColorLabel: Record<PoopDetails['color'], () => string> = {
  yellow: m.poopYellow,
  brown: m.poopBrown,
  green: m.poopGreen,
  black: m.poopBlack,
  red: m.poopRed,
  white: m.poopWhite,
}

/** 少 / 正常 / 多, for both pee and poop. */
export const amountLabel: Record<PoopDetails['amount'], () => string> = {
  small: m.poopAmountSmall,
  normal: m.poopAmountNormal,
  large: m.poopAmountLarge,
}

export const poopConsistencyLabel: Record<PoopDetails['consistency'], () => string> = {
  watery: m.poopWatery,
  soft: m.poopSoft,
  hard: m.poopHard,
}

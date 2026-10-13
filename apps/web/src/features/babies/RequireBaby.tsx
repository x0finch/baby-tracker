import type { ReactNode } from 'react'

import { BabyOnboarding } from './BabyOnboarding'
import { BabySwitcher } from './BabySwitcher'
import { useSelectedBaby } from './use-babies'

/** Wraps per-baby pages: onboarding until a baby exists, then the switcher above content. */
export function RequireBaby({ children }: { children: ReactNode }) {
  const { baby } = useSelectedBaby()
  if (!baby) return <BabyOnboarding />
  return (
    <>
      <BabySwitcher />
      {children}
    </>
  )
}

import { LazyMotion, MotionConfig, domMax } from 'motion/react'
import type { ReactNode } from 'react'

/** Quick spring with a touch of bounce, shared by moving indicators and list items. */
export const spring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 } as const

/** Motion for the app: `m.*` components, honouring the system's reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={spring}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** A small bounce for a control that just turned on (a chip, a toggle). */
export function popElement(element: HTMLElement) {
  if (prefersReducedMotion()) return
  element.animate([{ scale: 1 }, { scale: 1.07 }, { scale: 1 }], {
    duration: 240,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  })
}

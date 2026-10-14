import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/** Error under a form or action, announced to screen readers when it appears. */
export function FormError({
  children,
  size = 'body',
}: {
  children: ReactNode
  size?: 'body' | 'caption'
}) {
  return (
    <p
      role="alert"
      className={clsx('font-bold text-danger-text', size === 'caption' && 'text-caption')}
    >
      {children}
    </p>
  )
}

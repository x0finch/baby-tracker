import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type PillTone = 'muted' | 'danger'

const tones: Record<PillTone, string> = {
  muted: 'bg-surface text-fg-muted',
  danger: 'bg-danger-soft text-danger-text',
}

/** A small rounded label beside a name: a role, "已归档", "计时中". */
export function Pill({
  tone = 'muted',
  className,
  children,
}: {
  tone?: PillTone
  className?: string
  children: ReactNode
}) {
  return (
    <span className={clsx('rounded-full px-2 text-caption font-bold', tones[tone], className)}>
      {children}
    </span>
  )
}

import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-xl border-2 border-b-4 border-border bg-bg p-4', className)}
      {...props}
    />
  )
}

import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

export type CardTone = 'plain' | 'primary' | 'feeding' | 'sleep' | 'diaper'

const tones: Record<CardTone, string> = {
  plain: 'border-border bg-bg',
  primary: 'border-primary/40 bg-primary-soft',
  feeding: 'border-feeding/40 bg-feeding-soft',
  sleep: 'border-sleep/40 bg-sleep-soft',
  diaper: 'border-diaper/40 bg-diaper-soft',
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Tinted cards highlight one category (a running timer, a day's feeds). */
  tone?: CardTone
  as?: 'div' | 'section'
}

export function Card({ tone = 'plain', as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={clsx('rounded-xl border-2 border-b-4 p-4', tones[tone], className)}
      {...props}
    />
  )
}

import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

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

/** A card's heading; `small` for cards stacked in one section, like the AI settings. */
export function CardTitle({ small = false, children }: { small?: boolean; children: ReactNode }) {
  return (
    <h2 className={clsx('m-0 font-extrabold', small ? 'text-body' : 'text-title')}>{children}</h2>
  )
}

/** A card with one muted line: signed out, loading, failed to load. */
export function NoticeCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="m-0 text-fg-muted">{children}</p>
    </Card>
  )
}

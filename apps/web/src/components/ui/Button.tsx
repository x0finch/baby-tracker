import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

export type ButtonTone = 'primary' | 'feeding' | 'sleep' | 'diaper' | 'danger'
export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost'
export type ButtonSize = 'md' | 'lg'

const solidTones: Record<ButtonTone, string> = {
  primary: 'bg-primary border-primary-edge',
  feeding: 'bg-feeding border-feeding-edge',
  sleep: 'bg-sleep border-sleep-edge',
  diaper: 'bg-diaper border-diaper-edge',
  danger: 'bg-danger border-danger-edge',
}

const softTones: Record<ButtonTone, string> = {
  primary: 'bg-primary-soft text-primary-text border-primary/30',
  feeding: 'bg-feeding-soft text-feeding-text border-feeding/30',
  sleep: 'bg-sleep-soft text-sleep-text border-sleep/30',
  diaper: 'bg-diaper-soft text-diaper-text border-diaper/30',
  danger: 'bg-danger-soft text-danger-text border-danger/30',
}

const textTones: Record<ButtonTone, string> = {
  primary: 'text-primary-text',
  feeding: 'text-feeding-text',
  sleep: 'text-sleep-text',
  diaper: 'text-diaper-text',
  danger: 'text-danger-text',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

/**
 * Flat button with a solid bottom edge that collapses when pressed (no gradients or
 * shadows). Pressed state is visible on touch devices; nothing depends on hover.
 */
export function Button({
  tone = 'primary',
  variant = 'solid',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-extrabold',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'md' && 'min-h-touch px-4 text-body',
        size === 'lg' && 'min-h-14 px-6 text-label',
        block && 'w-full',
        variant === 'solid' && clsx('press border-b-4 text-on-accent', solidTones[tone]),
        variant === 'soft' && clsx('press border-2 border-b-4', softTones[tone]),
        variant === 'outline' &&
          clsx('press border-2 border-b-4 border-border bg-bg', textTones[tone]),
        variant === 'ghost' && clsx('active:bg-surface', textTones[tone]),
        className,
      )}
      {...props}
    />
  )
}

import { clsx } from 'clsx'
import { type InputHTMLAttributes, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

/** Text input with a visible label. Font size stays >= 16px to avoid iOS zoom on focus. */
export function Input({ label, hint, className, id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-bold">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className={clsx(
          'min-h-touch rounded-lg border-2 border-border bg-surface px-4 text-body text-fg',
          'placeholder:text-fg-muted focus:border-diaper focus:outline-none',
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-caption text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

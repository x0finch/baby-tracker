import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Classes for a toast's action, for links that act as one. */
export const toastActionClass = 'flex min-h-11 items-center px-2 font-extrabold text-primary'

export function ToastAction(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={toastActionClass} {...props} />
}

/** Bottom toast above the tab bar, announced politely to screen readers (<output> has the status role). */
export function Toast({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <output className="fixed inset-x-4 bottom-above-tab-bar z-10 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-fg px-4 py-2 text-bg">
      <span>{children}</span>
      {action}
    </output>
  )
}

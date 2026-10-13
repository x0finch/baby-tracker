import type { ReactNode } from 'react'

/** Bottom toast above the tab bar, announced politely to screen readers (<output> has the status role). */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <output className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+12px+env(safe-area-inset-bottom))] z-10 mx-auto flex w-[calc(100%-32px)] max-w-[calc(var(--container-app)-32px)] items-center justify-between gap-3 rounded-xl bg-fg px-4 py-2 text-bg">
      {children}
    </output>
  )
}

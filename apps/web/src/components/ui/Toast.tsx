import type { CSSProperties } from 'react'
import { type ExternalToast, Toaster as SonnerToaster, toast } from 'sonner'

// Above the tab bar, as `bottom-above-tab-bar`; sonner positions the stack itself.
const bottom = 'calc(var(--spacing-tab-bar) + 0.75rem + env(safe-area-inset-bottom))'

// As wide as `max-w-md`, the width the toasts had before.
const toasterStyle: CSSProperties & Record<'--width', string> = { '--width': '28rem' }

/** Hosts the app's toasts: one dark bar per message above the tab bar, newest in front. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      offset={{ bottom }}
      mobileOffset={{ bottom, left: '1rem', right: '1rem' }}
      style={toasterStyle}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center justify-between gap-3 rounded-xl bg-fg px-4 py-2 text-bg',
          actionButton: 'flex min-h-11 shrink-0 items-center px-2 font-extrabold text-primary',
        },
      }}
    />
  )
}

export interface ToastOptions {
  /** Replaces the toast with the same id instead of stacking another. */
  id?: string
  action?: { label: string; onClick: () => void }
  /** Milliseconds on screen; `Infinity` keeps it until acted on or swiped away. */
  duration?: number
  onDismiss?: () => void
}

const DEFAULT_DURATION_MS = 4000

/** Shows a toast; screen readers hear it through sonner's live region. */
export function showToast(message: string, options: ToastOptions = {}) {
  const external: ExternalToast = {
    id: options.id,
    duration: options.duration ?? DEFAULT_DURATION_MS,
    onDismiss: options.onDismiss,
    action: options.action,
  }
  return toast(message, external)
}

export const dismissToast = (id: string) => toast.dismiss(id)

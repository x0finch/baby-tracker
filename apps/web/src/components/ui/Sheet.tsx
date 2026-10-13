import { clsx } from 'clsx'
import { type ReactNode, useEffect, useRef } from 'react'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Bottom sheet built on the native <dialog> element, which provides focus trapping,
 * Escape to close and an inert background. Used instead of centered modals for forms.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Mirrors `open` so the native close event can tell a user dismissal (Escape) from the
  // parent closing the sheet, which must not call onClose again (e.g. when one sheet
  // hands over to another).
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first input, which would pop the keyboard on phones.
      dialog.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // Backdrop click is a pointer-only convenience; keyboard users close with Escape,
    // which the native dialog handles.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onClose={() => {
        if (openRef.current) onClose()
      }}
      onClick={(event) => {
        // Clicks on the backdrop target the dialog element itself.
        if (event.target === event.currentTarget) onClose()
      }}
      className={clsx(
        'fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-app max-h-[85dvh]',
        'rounded-t-xl border-2 border-b-0 border-border bg-bg p-0 text-fg focus:outline-none',
        'backdrop:bg-black/40',
      )}
    >
      <div className="flex flex-col gap-4 px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-border" />
        <h2 className="text-title font-extrabold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

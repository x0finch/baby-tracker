import { clsx } from 'clsx'
import { type PointerEvent, type ReactNode, useEffect, useRef } from 'react'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Pulled down this far (px), or flicked down this fast (px/ms), the sheet closes. */
const CLOSE_DISTANCE = 96
const CLOSE_VELOCITY = 0.6
/** The closing slide in styles/app.css (--sheet-close), plus slack for a busy frame. */
const CLOSE_MS = 500
const CLOSE_SLACK_MS = 120

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

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
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null)

  useEffect(() => {
    openRef.current = open
    const dialog = ref.current
    if (!dialog) return undefined
    if (open) {
      // Opening again mid-slide just stops the slide.
      delete dialog.dataset.closing
      if (dialog.open) return undefined
      // A sheet dragged closed last time keeps its inline position until it opens again.
      dialog.style.translate = ''
      dialog.showModal()
      // A reused sheet starts at the top, not where its previous content was scrolled to.
      dialog.scrollTop = 0
      // showModal() focuses the first input, which would pop the keyboard on phones.
      dialog.focus()
      return undefined
    }
    if (!dialog.open) return undefined
    // Slide down first, then close: every way of closing (backdrop, Escape, a drag, the
    // parent) looks the same, including in browsers without exit transitions (Safari).
    if (prefersReducedMotion()) {
      dialog.close()
      return undefined
    }
    dialog.dataset.closing = ''
    // Close once the slide has finished, so a slow frame never cuts it short; the timer
    // covers a transition that never runs (nothing to move, a hidden tab).
    const finish = () => {
      dialog.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
      delete dialog.dataset.closing
      dialog.close()
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target === dialog && event.propertyName === 'translate') finish()
    }
    dialog.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, CLOSE_MS + CLOSE_SLACK_MS)
    return () => {
      dialog.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [open])

  // Dragging the header pulls the sheet down; far or fast enough, it closes.
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { startY: event.clientY, startTime: event.timeStamp, dy: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dialog = ref.current
    if (!drag.current || !dialog) return
    drag.current.dy = Math.max(0, event.clientY - drag.current.startY)
    dialog.style.transition = 'none'
    dialog.style.translate = `0 ${drag.current.dy}px`
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dialog = ref.current
    const state = drag.current
    drag.current = null
    if (!dialog || !state) return
    dialog.style.transition = ''
    const velocity = state.dy / Math.max(1, event.timeStamp - state.startTime)
    if (state.dy > CLOSE_DISTANCE || (state.dy > 24 && velocity > CLOSE_VELOCITY)) {
      // Carry on down from where the finger let go.
      dialog.style.translate = '0 100%'
      onClose()
    } else {
      dialog.style.translate = ''
    }
  }

  return (
    // Backdrop click is a pointer-only convenience; keyboard users close with Escape,
    // which the native dialog handles.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onCancel={(event) => {
        // Escape: let the sheet slide away like any other close.
        event.preventDefault()
        onClose()
      }}
      onClose={() => {
        if (openRef.current) onClose()
      }}
      onClick={(event) => {
        // Clicks on the backdrop target the dialog element itself.
        if (event.target === event.currentTarget) onClose()
      }}
      className={clsx(
        'fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-app max-h-[85dvh]',
        'sheet rounded-t-xl border-2 border-b-0 border-border bg-bg p-0 text-fg focus:outline-none',
      )}
    >
      <div className="flex flex-col gap-4 px-4 pt-3 pb-safe-4">
        <div
          className="-mx-4 -mt-3 flex touch-none flex-col gap-4 px-4 pt-3"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-border" />
          <h2 className="text-title font-extrabold">{title}</h2>
        </div>
        {children}
      </div>
    </dialog>
  )
}

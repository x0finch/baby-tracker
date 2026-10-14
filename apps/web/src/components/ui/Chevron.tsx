/** A bold chevron for rows that open a page (`next`) and links that go back. */
export function Chevron({ direction = 'next' }: { direction?: 'next' | 'back' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-fg-muted">
      <path
        d={direction === 'next' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** How a navigation animates: between tabs, into a sub-page, or back out of one. */
export type PageTransition = 'tab' | 'forward' | 'back'

const depth = (pathname: string) => pathname.split('/').filter(Boolean).length

/**
 * The tabs sit at depth one or less (`/`, `/stats`, `/settings`); anything deeper is a
 * sub-page opened from one, so the depth change says which way to slide.
 */
export function pageTransition(from: string, to: string): PageTransition {
  const a = depth(from)
  const b = depth(to)
  if (a <= 1 && b <= 1) return 'tab'
  return b > a ? 'forward' : b < a ? 'back' : 'tab'
}

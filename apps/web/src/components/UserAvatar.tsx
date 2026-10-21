import { clsx } from 'clsx'
import { useState } from 'react'

/** A person's picture (from Google), or the first character of their name. */
export function UserAvatar({
  name,
  image,
  size = 'md',
}: {
  name: string
  image?: string | null
  size?: 'md' | 'lg'
}) {
  // A picture that fails to load (offline, expired link) falls back to the initial.
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'md' ? 'size-10 text-body' : 'size-14 text-title'
  if (image && !failed) {
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-full object-cover', sizeClass)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-on-accent',
        sizeClass,
      )}
    >
      {Array.from(name)[0] ?? ''}
    </span>
  )
}

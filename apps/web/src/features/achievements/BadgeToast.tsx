import type { Baby, Event } from '@bobo/shared'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Toast, toastActionClass } from '../../components/ui/Toast'
import { m } from '../../paraglide/messages.js'
import { useNow } from '../events/use-events'
import { computeBadges } from './achievements'
import { badgeLabel } from './badge-labels'

const seenKey = (babyId: string) => `bobo.seenBadges.${babyId}`

function readSeen(babyId: string): Set<string> | undefined {
  try {
    const raw = localStorage.getItem(seenKey(babyId))
    if (raw === null) return undefined
    const value: unknown = JSON.parse(raw)
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
  } catch {
    return undefined
  }
}

function writeSeen(babyId: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(seenKey(babyId), JSON.stringify([...ids]))
  } catch {
    // Without storage the toast may show again next time; harmless.
  }
}

/** Celebrates a newly earned badge once; badges earned before this device saw them stay quiet. */
export function BadgeToast({ baby, events }: { baby: Baby; events: readonly Event[] }) {
  const now = useNow(60_000)
  const earned = computeBadges(baby, events, now).filter((badge) => badge.earned)
  const earnedIds = earned.map((badge) => badge.id)
  // First visit on this device: what's already earned counts as seen (an idempotent write).
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => {
    const stored = readSeen(baby.id)
    if (stored) return stored
    writeSeen(baby.id, earnedIds)
    return new Set(earnedIds)
  })

  const badge = earned.find((candidate) => !seen.has(candidate.id))
  if (!badge) return null

  const dismiss = () => {
    writeSeen(baby.id, earnedIds)
    setSeen(new Set(earnedIds))
  }

  return (
    <Toast
      action={
        <Link
          to="/stats"
          search={{ view: 'achievements' }}
          onClick={dismiss}
          className={toastActionClass}
        >
          {m.badgeView()}
        </Link>
      }
    >
      {m.badgeNew({ title: badgeLabel(badge, baby.name).title })}
    </Toast>
  )
}

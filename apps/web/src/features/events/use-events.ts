import { type Event, isRunning } from '@bobo/shared'
import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useMemo, useState } from 'react'

import { useLocalStore } from '../../db'

/** All non-deleted events of a baby, newest first. */
export function useBabyEvents(babyId: string): Event[] {
  const { events } = useLocalStore()
  const { data } = useLiveQuery({
    query: (q) => q.from({ event: events }).where(({ event }) => eq(event.babyId, babyId)),
  })
  return useMemo(
    () =>
      (data ?? [])
        .filter((event) => event.deletedAt === null)
        .toSorted((a, b) => b.startAt - a.startAt),
    [data],
  )
}

/** Ids of babies that have a timer running, for indicators across babies. */
export function useBabiesWithRunningTimers(): Set<string> {
  const { events } = useLocalStore()
  const { data } = useLiveQuery({ query: (q) => q.from({ event: events }) })
  return useMemo(
    () =>
      new Set(
        (data ?? [])
          .filter((event) => event.deletedAt === null && isRunning(event))
          .map((event) => event.babyId),
      ),
    [data],
  )
}

/** Current time, refreshed every `intervalMs` while `active`. Timers derive from this. */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    // Catch up immediately when the app returns from the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, active])
  return now
}

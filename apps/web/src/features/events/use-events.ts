import { type Event, isRunning } from '@bobo/shared'
import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useMemo } from 'react'

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

/** Non-deleted events of several babies, newest first, keyed by baby. */
export function useEventsByBaby(babyIds: readonly string[]): ReadonlyMap<string, Event[]> {
  const { events } = useLocalStore()
  const { data } = useLiveQuery({ query: (q) => q.from({ event: events }) })
  const key = babyIds.join(',')
  return useMemo(() => {
    const byBaby = new Map<string, Event[]>(key.split(',').map((id) => [id, []]))
    for (const event of data ?? []) {
      if (event.deletedAt === null) byBaby.get(event.babyId)?.push(event)
    }
    for (const list of byBaby.values()) list.sort((a, b) => b.startAt - a.startAt)
    return byBaby
  }, [data, key])
}

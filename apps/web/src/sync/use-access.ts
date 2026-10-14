import type { Baby, Event, FamilySummary } from '@bobo/shared'
import { useLiveQuery } from '@tanstack/react-db'
import { useMemo } from 'react'

import { useLocalStore } from '../db'
import { type Permissions, babyFamilyChoices, babyPermissions, canEditEvent } from './access'
import { getAccess, getAccount } from './local'

export interface AccessView {
  /** Families from the last pull; undefined while signed out or before the first pull. */
  access: FamilySummary[] | undefined
  userId: string | undefined
  forBaby: (baby: Pick<Baby, 'familyId'> | undefined) => Permissions
  canEditEvent: (event: Pick<Event, 'familyId' | 'createdBy'>) => boolean
  /** Where a new baby can go; `null` stands for a new family of the user's own. */
  babyFamilies: ReturnType<typeof babyFamilyChoices>
}

/** The signed-in user's permissions, updated when a pull changes their access. */
export function useAccess(): AccessView {
  const store = useLocalStore()
  const { data: meta } = useLiveQuery({ query: (q) => q.from({ meta: store.meta }) })
  return useMemo(() => {
    const access = getAccess(store)
    const userId = getAccount(store)?.userId
    return {
      access,
      userId,
      forBaby: (baby) => babyPermissions(access, baby),
      canEditEvent: (event) => canEditEvent(access, event, userId),
      babyFamilies: babyFamilyChoices(store),
    }
    // Recomputed whenever the meta records (account, access) change.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [store, meta])
}

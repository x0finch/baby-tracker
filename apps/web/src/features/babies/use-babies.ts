import type { Baby } from '@bobo/shared'
import { useLiveQuery } from '@tanstack/react-db'
import { useCallback, useMemo } from 'react'

import { useLocalStore } from '../../db'
import { createStoredValue, stringCodec, useStore } from '../../lib/store'
import { isActiveBaby, resolveSelectedBaby, sortBabies } from './records'

export function useBabies(): { active: Baby[]; archived: Baby[] } {
  const { babies } = useLocalStore()
  const { data } = useLiveQuery({ query: (q) => q.from({ baby: babies }) })

  return useMemo(() => {
    const all = sortBabies((data ?? []).filter((baby) => baby.deletedAt === null))
    return {
      active: all.filter(isActiveBaby),
      archived: all.filter((baby) => !isActiveBaby(baby)),
    }
  }, [data])
}

// The selected baby is a per-device preference, not synced data.
const selectedBabyId = createStoredValue('bobo.selectedBabyId', stringCodec, null)

export const selectBaby = (id: string) => selectedBabyId.set(id)

export function useSelectedBaby(): {
  baby: Baby | undefined
  select: (id: string) => void
} {
  const { active } = useBabies()
  const storedId = useStore(selectedBabyId)
  const baby = useMemo(() => resolveSelectedBaby(active, storedId), [active, storedId])
  const select = useCallback((id: string) => selectBaby(id), [])
  return { baby, select }
}

import type { Baby } from '@bobo/shared'
import { useLiveQuery } from '@tanstack/react-db'
import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { useLocalStore } from '../../db'
import { isActiveBaby, resolveSelectedBaby, sortBabies } from './records'

export function useBabies(): { active: Baby[]; archived: Baby[] } {
  const { babies } = useLocalStore()
  const { data } = useLiveQuery(() => babies, [babies])

  return useMemo(() => {
    const all = sortBabies((data ?? []).filter((baby) => baby.deletedAt === null))
    return {
      active: all.filter(isActiveBaby),
      archived: all.filter((baby) => !isActiveBaby(baby)),
    }
  }, [data])
}

// The selected baby is a per-device preference, not synced data.
const SELECTED_KEY = 'bobo.selectedBabyId'
const SELECTED_EVENT = 'bobo:selected-baby'

// Used when localStorage is unavailable, so the selection still works until reload.
let memorySelectedId: string | null = null

function readSelectedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY) ?? memorySelectedId
  } catch {
    return memorySelectedId
  }
}

function subscribeSelectedId(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SELECTED_KEY) onChange()
  }
  window.addEventListener(SELECTED_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(SELECTED_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function selectBaby(id: string) {
  memorySelectedId = id
  try {
    localStorage.setItem(SELECTED_KEY, id)
  } catch {
    // Falls back to memorySelectedId.
  }
  window.dispatchEvent(new Event(SELECTED_EVENT))
}

export function useSelectedBaby(): {
  baby: Baby | undefined
  select: (id: string) => void
} {
  const { active } = useBabies()
  const storedId = useSyncExternalStore(subscribeSelectedId, readSelectedId, () => null)
  const baby = useMemo(() => resolveSelectedBaby(active, storedId), [active, storedId])
  const select = useCallback((id: string) => selectBaby(id), [])
  return { baby, select }
}

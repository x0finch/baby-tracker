import { useCallback, useSyncExternalStore } from 'react'

// Babies to log for together (e.g. twins); a per-device preference, not synced data.
const TOGETHER_KEY = 'bobo.logTogether'
const TOGETHER_EVENT = 'bobo:log-together'

let memoryIds: string[] = []

function readIds(): string {
  try {
    return localStorage.getItem(TOGETHER_KEY) ?? JSON.stringify(memoryIds)
  } catch {
    return JSON.stringify(memoryIds)
  }
}

function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(TOGETHER_EVENT, onChange)
  return () => window.removeEventListener(TOGETHER_EVENT, onChange)
}

/**
 * Babies that are logged together with the selected one. The list is stored as a whole, so
 * twins stay linked whichever of them is selected.
 */
export function useLogTogether(): {
  together: ReadonlySet<string>
  toggle: (babyId: string, currentId: string) => void
} {
  const raw = useSyncExternalStore(subscribe, readIds, () => '[]')
  const together = new Set(parseIds(raw))
  const toggle = useCallback((babyId: string, currentId: string) => {
    const ids = new Set(parseIds(readIds()))
    if (ids.has(babyId)) {
      ids.delete(babyId)
      // A group of one isn't a group: unlinking the last other baby clears the selection.
      if (ids.size === 1) ids.clear()
    } else {
      ids.add(babyId)
      ids.add(currentId)
    }
    memoryIds = [...ids]
    try {
      localStorage.setItem(TOGETHER_KEY, JSON.stringify(memoryIds))
    } catch {
      // Falls back to memoryIds.
    }
    window.dispatchEvent(new Event(TOGETHER_EVENT))
  }, [])
  return { together, toggle }
}

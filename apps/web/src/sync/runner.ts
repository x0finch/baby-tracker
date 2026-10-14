import { useSyncExternalStore } from 'react'

import type { LocalStore } from '../db'
import { HttpError, httpSyncApi } from './api'
import { type SyncApi, syncOnce } from './engine'
import { getAccount } from './local'

export type SyncPhase = 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error' | 'unauthorized'

export interface SyncState {
  phase: SyncPhase
  lastSyncedAt?: number
}

const LOCAL_CHANGE_DELAY_MS = 3_000
const INTERVAL_MS = 60_000

let state: SyncState = { phase: 'signed-out' }
const listeners = new Set<() => void>()

function setState(next: SyncState) {
  state = next
  for (const listener of listeners) listener()
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => state,
    () => state,
  )
}

let running: Promise<void> | null = null
let again = false
let current: { store: LocalStore; api: SyncApi } | null = null

/** Runs one sync round; concurrent requests are coalesced into one follow-up round. */
export function requestSync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      // Rounds must not overlap; a request during a round triggers exactly one more.
      // oxlint-disable-next-line no-await-in-loop
      await runRound()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function runRound() {
  if (!current) return
  const { store, api } = current
  if (!getAccount(store)) {
    setState({ phase: 'signed-out' })
    return
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ ...state, phase: 'offline' })
    return
  }
  setState({ ...state, phase: 'syncing' })
  try {
    const result = await syncOnce(store, api)
    if (result.rejected.length > 0) console.warn('Sync rejected changes', result.rejected)
    setState({ phase: 'idle', lastSyncedAt: Date.now() })
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      setState({ ...state, phase: 'unauthorized' })
    } else {
      console.warn('Sync failed', error)
      setState({ ...state, phase: navigator.onLine ? 'error' : 'offline' })
    }
  }
}

const now = () => void requestSync()

/**
 * Starts background sync: on start, when coming back online or to the foreground, shortly
 * after local changes, and periodically while visible. Returns a stop function.
 */
export function startSync(store: LocalStore, api: SyncApi = httpSyncApi): () => void {
  current = { store, api }
  let timer: ReturnType<typeof setTimeout> | undefined

  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void requestSync(), LOCAL_CHANGE_DELAY_MS)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') now()
  }

  const outbox = store.outbox.subscribeChanges((changes) => {
    if (changes.some((change) => change.type !== 'delete')) soon()
  })
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') now()
  }, INTERVAL_MS)
  window.addEventListener('online', now)
  document.addEventListener('visibilitychange', onVisible)
  now()

  return () => {
    clearTimeout(timer)
    clearInterval(interval)
    outbox.unsubscribe()
    window.removeEventListener('online', now)
    document.removeEventListener('visibilitychange', onVisible)
    current = null
  }
}

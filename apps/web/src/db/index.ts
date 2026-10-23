import { use } from 'react'

import { getAccount } from '../sync/local'
import { upgradeRecords } from '../sync/upgrade'
import { type LocalStore, openLocalStore } from './local-store'

export type { LocalStore, StorageMode } from './local-store'

let store: Promise<LocalStore> | undefined

/** The app-wide store, opened once on first use (never during shell prerendering). */
export function getLocalStore(): Promise<LocalStore> {
  store ??= openLocalStore().then((opened) => {
    upgradeRecords(opened)
    return opened
  })
  return store
}

/** Suspends until the local store is open. Render under a Suspense boundary. */
export function useLocalStore(): LocalStore {
  return use(getLocalStore())
}

/**
 * Whether this device is signed in, for route loaders (outside React): they prefetch
 * account-side data only then.
 */
export async function isSignedIn(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  return getAccount(await getLocalStore()) !== undefined
}

import { use } from 'react'

import { type LocalStore, openLocalStore } from './local-store'

export type { LocalStore, StorageMode } from './local-store'

let store: Promise<LocalStore> | undefined

/** The app-wide store, opened once on first use (never during shell prerendering). */
function getLocalStore(): Promise<LocalStore> {
  store ??= openLocalStore()
  return store
}

/** Suspends until the local store is open. Render under a Suspense boundary. */
export function useLocalStore(): LocalStore {
  return use(getLocalStore())
}

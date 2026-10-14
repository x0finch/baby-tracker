import { useEffect } from 'react'

import { useLocalStore } from '../db'
import { startSync } from './runner'

/** Mounts background sync for the app's lifetime (it idles while signed out). */
export function SyncRunner() {
  const store = useLocalStore()
  useEffect(() => startSync(store), [store])
  return null
}

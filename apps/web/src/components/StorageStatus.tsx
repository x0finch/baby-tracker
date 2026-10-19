import { clsx } from 'clsx'

import { type StorageMode, useLocalStore } from '../db'
import { m } from '../paraglide/messages.js'
import { useAccount } from '../sync/use-access'

const descriptions: Record<StorageMode, () => string> = {
  persistent: m.storagePersistent,
  'best-effort': m.storageBestEffort,
  memory: m.storageMemory,
}

/** Where records are kept: on this device only, or also in the cloud once signed in. */
export function StorageStatus() {
  const { mode } = useLocalStore()
  const signedIn = useAccount() !== undefined
  const text = !signedIn
    ? descriptions[mode]()
    : mode === 'memory'
      ? m.storageMemorySynced()
      : m.storageSynced()

  return (
    <p className={clsx(mode === 'memory' ? 'font-bold text-danger-text' : 'text-fg-muted')}>
      {text}
    </p>
  )
}

import { clsx } from 'clsx'

import { type StorageMode, useLocalStore } from '../db'
import { m } from '../paraglide/messages.js'

const descriptions: Record<StorageMode, () => string> = {
  persistent: m.storagePersistent,
  'best-effort': m.storageBestEffort,
  memory: m.storageMemory,
}

export function StorageStatus() {
  const { mode } = useLocalStore()

  return (
    <p className={clsx(mode === 'memory' ? 'font-bold text-danger-text' : 'text-fg-muted')}>
      {descriptions[mode]()}
    </p>
  )
}

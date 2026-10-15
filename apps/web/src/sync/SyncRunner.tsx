import { useEffect } from 'react'

import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { showToast } from '../components/ui/Toast'
import { useLocalStore } from '../db'
import {
  connectIfSignedIn,
  resolveClaimChoice,
  useClaimChoice,
} from '../features/account/connection'
import { m } from '../paraglide/messages.js'
import { startSync, useSyncState } from './runner'

const REJECTED_TOAST_MS = 5000

/** Tells the user when the server refused changes (e.g. their role changed while offline). */
function useRejectedToast() {
  const { rejected } = useSyncState()
  useEffect(() => {
    if (rejected) {
      showToast(m.syncRejected({ count: rejected.count }), {
        id: 'sync-rejected',
        tone: 'error',
        duration: REJECTED_TOAST_MS,
      })
    }
  }, [rejected])
}

/** Mounts background sync and links a fresh sign-in to this device. */
export function SyncRunner() {
  const store = useLocalStore()
  const choice = useClaimChoice()
  useRejectedToast()

  useEffect(() => {
    const stop = startSync(store)
    // The join page links the account itself, after the invite is accepted.
    if (!window.location.pathname.startsWith('/join/')) {
      void connectIfSignedIn(store)
    }
    return stop
  }, [store])

  return (
    <>
      {/* Closing without choosing keeps the device unlinked; it asks again on the next start. */}
      <Sheet open={choice !== null} onClose={() => undefined} title={m.claimTitle()}>
        {choice && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-fg-muted">{m.claimBody({ count: choice.unclaimed })}</p>
            {choice.families.map((family) => (
              <Button
                key={family.id}
                size="lg"
                block
                onClick={() => void resolveClaimChoice(store, family)}
              >
                {m.claimMerge({ name: family.name })}
              </Button>
            ))}
            <Button variant="outline" block onClick={() => void resolveClaimChoice(store, 'new')}>
              {m.claimNew()}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

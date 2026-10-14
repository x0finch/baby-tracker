import { useEffect, useState } from 'react'

import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Toast } from '../components/ui/Toast'
import { useLocalStore } from '../db'
import { m } from '../paraglide/messages.js'
import { connectIfSignedIn, resolveClaimChoice, useClaimChoice } from './connection'
import { startSync, useSyncState } from './runner'

const REJECTED_TOAST_MS = 5000

/** Tells the user when the server refused changes (e.g. their role changed while offline). */
function RejectedToast() {
  const { rejected } = useSyncState()
  const [hiddenAt, setHiddenAt] = useState<number | null>(null)
  useEffect(() => {
    if (!rejected) return undefined
    const id = setTimeout(() => setHiddenAt(rejected.at), REJECTED_TOAST_MS)
    return () => clearTimeout(id)
  }, [rejected])
  if (!rejected || hiddenAt === rejected.at) return null
  return (
    <Toast>
      <span>{m.syncRejected({ count: rejected.count })}</span>
    </Toast>
  )
}

/** Mounts background sync and links a fresh sign-in to this device. */
export function SyncRunner() {
  const store = useLocalStore()
  const choice = useClaimChoice()

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
      <RejectedToast />
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

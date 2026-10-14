import { useEffect } from 'react'

import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { useLocalStore } from '../db'
import { m } from '../paraglide/messages.js'
import { unclaimedCount } from './account'
import { connectIfSignedIn, resolveClaimChoice, useClaimChoice } from './connection'
import { startSync } from './runner'

/** Mounts background sync and links a fresh sign-in to this device. */
export function SyncRunner() {
  const store = useLocalStore()
  const choice = useClaimChoice()

  useEffect(() => {
    const stop = startSync(store)
    void connectIfSignedIn(store, () => unclaimedCount(store))
    return stop
  }, [store])

  return (
    // Closing without choosing keeps the device unlinked; it asks again on the next start.
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
  )
}

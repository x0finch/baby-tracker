import { useState } from 'react'

import { formatDate } from '../lib/i18n'
import { type UpdateCheck, canUpdate, checkForUpdateNow, useWaitingUpdate } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

/** "版本 2df2dce · 10月14日" */
export const versionLabel = () =>
  m.settingsVersionDated({
    build: import.meta.env.APP_BUILD,
    date: formatDate(import.meta.env.APP_BUILT_AT, { month: 'long', day: 'numeric' }),
  })

/** The version for the settings index: says so when an update is waiting. */
export function useVersionSummary() {
  return useWaitingUpdate() ? m.updateReady() : versionLabel()
}

const resultText: Record<Exclude<UpdateCheck, 'ready'>, () => string> = {
  latest: m.updateLatest,
  offline: m.updateOffline,
  failed: m.updateFailed,
}

/** The running version, with a button to look for a newer one and apply it. */
export function VersionCard() {
  const update = useWaitingUpdate()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheck>()

  const check = async () => {
    setChecking(true)
    setResult(undefined)
    setResult(await checkForUpdateNow())
    setChecking(false)
  }
  const status = update
    ? m.updateReady()
    : checking
      ? m.updateChecking()
      : result && result !== 'ready'
        ? resultText[result]()
        : undefined

  return (
    <Card className="flex flex-col gap-3">
      <p className="m-0 font-bold">{versionLabel()}</p>
      {canUpdate() && (
        <>
          {status && (
            <p className="m-0 text-fg-muted" aria-live="polite">
              {status}
            </p>
          )}
          {update ? (
            <Button block onClick={update}>
              {m.updateApply()}
            </Button>
          ) : (
            <Button
              variant="soft"
              tone="primary"
              block
              disabled={checking}
              onClick={() => void check()}
            >
              {m.updateCheck()}
            </Button>
          )}
        </>
      )}
    </Card>
  )
}

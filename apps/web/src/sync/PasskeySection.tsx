import { useEffect, useState } from 'react'

import { Button } from '../components/ui/Button'
import { formatDate } from '../lib/i18n'
import { m } from '../paraglide/messages.js'
import {
  type PasskeyInfo,
  addPasskey,
  deletePasskey,
  isPasskeyCancel,
  listPasskeys,
  needsFreshSignIn,
  passkeysSupported,
} from './passkey'

/** The signed-in account's passkeys: add one for this device, or remove old ones. */
export function PasskeySection() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>()
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    listPasskeys().then(
      (list) => current && setPasskeys(list),
      () => current && setPasskeys([]),
    )
    return () => {
      current = false
    }
  }, [])

  if (!passkeysSupported() || !passkeys) return null

  async function add() {
    setBusy(true)
    setMessage(undefined)
    try {
      await addPasskey(m.passkeyDefaultName({ date: formatDate(Date.now()) }))
      setPasskeys(await listPasskeys())
      setMessage(m.passkeyAdded())
    } catch (error) {
      if (!isPasskeyCancel(error)) {
        setMessage(needsFreshSignIn(error) ? m.passkeyNeedsFreshSignIn() : m.passkeyAddFailed())
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setMessage(undefined)
    try {
      await deletePasskey(id)
      setPasskeys((list) => list?.filter((item) => item.id !== id))
    } catch {
      setMessage(m.actionFailed())
    }
  }

  return (
    <section className="flex flex-col gap-2 border-t-2 border-border pt-3">
      <h3 className="m-0 font-extrabold">{m.passkeyTitle()}</h3>
      <p className="m-0 text-caption text-fg-muted">{m.passkeyIntro()}</p>
      {passkeys.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {passkeys.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {item.name || formatDate(new Date(item.createdAt))}
              </span>
              <Button
                variant="ghost"
                tone="danger"
                aria-label={m.passkeyRemoveLabel({ name: item.name ?? '' })}
                onClick={() => void remove(item.id)}
              >
                {m.passkeyRemove()}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="soft" tone="primary" disabled={busy} onClick={() => void add()}>
        {m.passkeyAdd()}
      </Button>
      {message && <output className="m-0 font-bold">{message}</output>}
    </section>
  )
}

import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useState } from 'react'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { Sheet } from '../components/ui/Sheet'
import { useLocalStore } from '../db'
import { formatTime } from '../lib/i18n'
import { m } from '../paraglide/messages.js'
import {
  type SessionUser,
  deleteAccountRemote,
  disconnectLocal,
  httpAccountApi,
  signOutRemote,
} from './account'
import { connectIfSignedIn } from './connection'
import { getAccount } from './local'
import { disablePush } from './notifications'
import { PasskeySection } from './PasskeySection'
import { requestSync, useSyncState } from './runner'
import { SignInOptions } from './SignInOptions'

function SyncStatusLine() {
  const { phase, lastSyncedAt } = useSyncState()
  const text =
    phase === 'syncing'
      ? m.syncStatusSyncing()
      : phase === 'offline'
        ? m.syncStatusOffline()
        : phase === 'error'
          ? m.syncStatusError()
          : phase === 'unauthorized'
            ? m.syncStatusUnauthorized()
            : lastSyncedAt
              ? m.syncStatusIdle({ time: formatTime(lastSyncedAt) })
              : m.syncStatusNever()
  return <p className="m-0 text-fg-muted">{text}</p>
}

/** Sign-in, sync status and sign-out in settings. */
export function AccountCard() {
  const store = useLocalStore()
  // Re-render when the account meta record changes (sign-in completes, sign-out).
  useLiveQuery({ query: (q) => q.from({ meta: store.meta }) })
  const { data: pending } = useLiveQuery({ query: (q) => q.from({ entry: store.outbox }) })
  const account = getAccount(store)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const userId = account?.userId
  useEffect(() => {
    if (!userId) return
    httpAccountApi.me().then(setUser, () => setUser(null))
  }, [userId])

  async function deleteAccount() {
    setDeleteFailed(false)
    try {
      await deleteAccountRemote()
    } catch {
      // Keep everything on the device if the server could not delete the account.
      setDeleteFailed(true)
      return
    }
    await disablePush().catch(() => undefined)
    disconnectLocal(store, true)
    setUser(null)
    setDeleting(false)
  }

  async function signOut(clearData: boolean) {
    // Reminders for this account shouldn't keep arriving on this device.
    await disablePush().catch(() => undefined)
    try {
      await signOutRemote()
    } catch {
      // Already signed out on the server, or offline; forget the account locally anyway.
    }
    disconnectLocal(store, clearData)
    setUser(null)
    setSigningOut(false)
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.accountTitle()}</h2>
      {account ? (
        <>
          {user && (
            <div className="flex flex-col">
              <span className="font-extrabold">{user.name}</span>
              <span className="text-caption text-fg-muted">{user.email}</span>
            </div>
          )}
          <SyncStatusLine />
          {(pending?.length ?? 0) > 0 && (
            <p className="m-0 text-caption text-fg-muted">
              {m.pendingChanges({ count: pending?.length ?? 0 })}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="soft" tone="diaper" onClick={() => void requestSync()}>
              {m.syncNow()}
            </Button>
            <Button variant="outline" onClick={() => setSigningOut(true)}>
              {m.signOut()}
            </Button>
          </div>
          <Sheet open={signingOut} onClose={() => setSigningOut(false)} title={m.signOut()}>
            <Button block onClick={() => void signOut(false)}>
              {m.signOutKeep()}
            </Button>
            <Button variant="ghost" tone="danger" block onClick={() => void signOut(true)}>
              {m.signOutClear()}
            </Button>
            <p className="m-0 text-center text-caption text-fg-muted">{m.signOutClearHint()}</p>
          </Sheet>
          <PasskeySection />
          <Button variant="ghost" tone="danger" onClick={() => setDeleting(true)}>
            {m.deleteAccount()}
          </Button>
          <ConfirmSheet
            open={deleting}
            onClose={() => setDeleting(false)}
            title={m.deleteAccount()}
            confirmLabel={m.deleteAccountConfirm()}
            onConfirm={() => void deleteAccount()}
            error={deleteFailed ? m.deleteAccountFailed() : undefined}
          >
            {m.deleteAccountBody()}
          </ConfirmSheet>
        </>
      ) : (
        <>
          <p className="m-0 text-fg-muted">{m.accountSignedOutBody()}</p>
          <SignInOptions onSignedIn={() => connectIfSignedIn(store)} />
        </>
      )}
    </Card>
  )
}

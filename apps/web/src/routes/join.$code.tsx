import type { InvitePreview } from '@bobo/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useLocalStore } from '../db'
import { familyApi } from '../features/family/api'
import { roleLabel } from '../features/family/FamilyCard'
import { m } from '../paraglide/messages.js'
import { httpAccountApi, signInWithGoogle } from '../sync/account'
import { HttpError } from '../sync/api'
import { connectIfSignedIn } from '../sync/connection'
import { getAccount } from '../sync/local'
import { requestSync } from '../sync/runner'
import { SignInOptions } from '../sync/SignInOptions'

export const Route = createFileRoute('/join/$code')({
  component: JoinPage,
})

// Set before leaving for Google sign-in, so the invite is accepted when the user returns.
const PENDING_KEY = 'bobo.pendingInvite'

function readPending(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

function writePending(code: string | null) {
  try {
    if (code) sessionStorage.setItem(PENDING_KEY, code)
    else sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Without storage the user taps "join" again after signing in.
  }
}

type Phase =
  | { name: 'loading' }
  | { name: 'missing' }
  | { name: 'ready'; preview: InvitePreview }
  | { name: 'joining'; preview: InvitePreview }
  | { name: 'joined'; preview: InvitePreview }
  | { name: 'member'; preview: InvitePreview }
  | { name: 'failed'; preview: InvitePreview }

const statusMessage = {
  used: m.joinUsed,
  revoked: m.joinRevoked,
  expired: m.joinExpired,
} as const

function JoinPage() {
  const { code } = Route.useParams()
  const store = useLocalStore()
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })

  async function join(preview: InvitePreview) {
    setPhase({ name: 'joining', preview })
    try {
      if (!(await httpAccountApi.me())) {
        writePending(code)
        await signInWithGoogle(`/join/${code}`)
        return
      }
      writePending(null)
      try {
        await familyApi.acceptInvite(code)
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 409)) throw error
        setPhase({ name: 'member', preview })
        return
      }
      setPhase({ name: 'joined', preview })
      // A first sign-in on this device links the account now (the family is already joined);
      // otherwise the next pull sees the new family and fetches its records.
      if (getAccount(store)) await requestSync()
      else await connectIfSignedIn(store)
    } catch {
      setPhase({ name: 'failed', preview })
    }
  }

  useEffect(() => {
    let current = true
    familyApi.previewInvite(code).then(
      (preview) => {
        if (!current) return
        setPhase({ name: 'ready', preview })
        if (preview.status === 'active' && readPending() === code) void join(preview)
      },
      () => current && setPhase({ name: 'missing' }),
    )
    return () => {
      current = false
    }
    // Runs once per invite code; join() only reads the latest state through setters.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={m.joinTitle()} />
      <Card className="flex flex-col gap-3">
        {phase.name === 'loading' && <p className="m-0 text-fg-muted">{m.joinLoading()}</p>}
        {phase.name === 'missing' && <p className="m-0">{m.joinNotFound()}</p>}
        {phase.name !== 'loading' && phase.name !== 'missing' && (
          <InviteBody code={code} phase={phase} onJoin={(preview) => void join(preview)} />
        )}
      </Card>
    </section>
  )
}

function InviteBody({
  code,
  phase,
  onJoin,
}: {
  code: string
  phase: Exclude<Phase, { name: 'loading' } | { name: 'missing' }>
  onJoin: (preview: InvitePreview) => void
}) {
  const { preview } = phase
  const signedIn = getAccount(useLocalStore()) !== undefined
  const navigate = useNavigate()
  const home = (
    <Button size="lg" block onClick={() => void navigate({ to: '/' })}>
      {m.joinGoHome()}
    </Button>
  )

  return (
    <>
      <p className="m-0 text-label font-bold">
        {m.joinBody({
          inviter: preview.inviterName,
          role: roleLabel[preview.role](),
          family: preview.familyName,
        })}
      </p>
      {preview.babyNames && preview.babyNames.length > 0 && (
        <p className="m-0 text-fg-muted">{m.joinBabies({ names: preview.babyNames.join('、') })}</p>
      )}
      {phase.name === 'joined' && (
        <>
          <p className="m-0 font-bold">{m.joinDone({ family: preview.familyName })}</p>
          {home}
        </>
      )}
      {phase.name === 'member' && (
        <>
          <p className="m-0 font-bold">{m.joinAlreadyMember()}</p>
          {home}
        </>
      )}
      {(phase.name === 'ready' || phase.name === 'joining' || phase.name === 'failed') &&
        (preview.status !== 'active' ? (
          <p className="m-0 font-bold text-danger-text">{statusMessage[preview.status]()}</p>
        ) : signedIn ? (
          <Button
            size="lg"
            block
            disabled={phase.name === 'joining'}
            onClick={() => onJoin(preview)}
          >
            {m.joinAccept()}
          </Button>
        ) : (
          <>
            <p className="m-0 text-fg-muted">{m.joinSignIn()}</p>
            <SignInOptions
              returnTo={`/join/${code}`}
              onGoogle={() => writePending(code)}
              onSignedIn={() => onJoin(preview)}
            />
          </>
        ))}
      {phase.name === 'failed' && (
        <p className="m-0 font-bold text-danger-text">{m.actionFailed()}</p>
      )}
    </>
  )
}

import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { m } from '../paraglide/messages.js'
import { sendEmailCode, signInWithEmailCode, signInWithGoogle } from './account'
import { HttpError } from './api'

const RESEND_SECONDS = 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError && error.status === 429) return m.emailTooMany()
  return fallback
}

/**
 * Google sign-in plus passwordless email sign-in with a 6-digit code. `onSignedIn` runs after
 * an email sign-in; Google sign-in leaves the page and comes back to `returnTo`.
 */
export function SignInOptions({
  returnTo,
  onGoogle,
  onSignedIn,
}: {
  returnTo?: string
  /** Runs before leaving for Google, e.g. to remember what to do on return. */
  onGoogle?: () => void
  onSignedIn: () => void | Promise<void>
}) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const id = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  async function google() {
    setError(undefined)
    onGoogle?.()
    try {
      await signInWithGoogle(returnTo)
    } catch {
      setError(m.signInFailed())
    }
  }

  async function send(formEvent?: FormEvent) {
    formEvent?.preventDefault()
    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      setError(m.emailInvalid())
      return
    }
    setError(undefined)
    setBusy(true)
    try {
      await sendEmailCode(address)
      setStep('code')
      setCode('')
      setResendIn(RESEND_SECONDS)
    } catch (sendError) {
      setError(errorMessage(sendError, m.emailSendFailed()))
    } finally {
      setBusy(false)
    }
  }

  async function verify(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError(m.emailCodeFormat())
      return
    }
    setError(undefined)
    setBusy(true)
    try {
      await signInWithEmailCode(email.trim(), code)
      await onSignedIn()
    } catch (verifyError) {
      setError(
        verifyError instanceof HttpError && verifyError.status !== 429
          ? m.emailCodeInvalid()
          : errorMessage(verifyError, m.emailSendFailed()),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" block onClick={() => void google()}>
        {m.signInGoogle()}
      </Button>
      <div aria-hidden className="flex items-center gap-3 text-caption text-fg-muted">
        <span className="h-0.5 flex-1 bg-border" />
        {m.signInOr()}
        <span className="h-0.5 flex-1 bg-border" />
      </div>
      {step === 'email' ? (
        <form noValidate onSubmit={(e) => void send(e)} className="flex flex-col gap-3">
          <Input
            label={m.emailLabel()}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={m.emailPlaceholder()}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="outline" block disabled={busy}>
            {m.emailSendCode()}
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={(e) => void verify(e)} className="flex flex-col gap-3">
          <p className="m-0 text-caption text-fg-muted">
            {m.emailCodeSent({ email: email.trim() })}
          </p>
          <Input
            label={m.emailCodeLabel()}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="text-center text-title tracking-[0.4em] tabular-nums"
            value={code}
            onChange={(e) => setCode(e.target.value.replaceAll(/\D/g, '').slice(0, 6))}
          />
          <Button type="submit" block disabled={busy}>
            {m.emailSignIn()}
          </Button>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep('email')}>
              {m.emailChange()}
            </Button>
            <Button variant="ghost" disabled={busy || resendIn > 0} onClick={() => void send()}>
              {resendIn > 0 ? m.emailResendIn({ seconds: resendIn }) : m.emailResend()}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="m-0 font-bold text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

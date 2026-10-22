import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { showToast } from '../../components/ui/Toast'
import { HttpError } from '../../lib/api'
import { m } from '../../paraglide/messages.js'
import { changePassword } from './account'
import { MIN_PASSWORD_LENGTH } from './password'

/** Changes the password of an email account, given the current one. */
export function ChangePassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const change = useMutation({
    mutationFn: () => changePassword(email, current, next),
    onSuccess: () => {
      close()
      showToast(m.passwordChanged(), { tone: 'success' })
    },
  })

  function close() {
    setOpen(false)
    setCurrent('')
    setNext('')
    setTooShort(false)
    change.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setTooShort(next.length < MIN_PASSWORD_LENGTH)
    if (next.length >= MIN_PASSWORD_LENGTH) change.mutate()
  }

  const error = tooShort
    ? m.passwordTooShort({ min: MIN_PASSWORD_LENGTH })
    : change.error instanceof HttpError && change.error.status === 400
      ? m.passwordCurrentWrong()
      : change.error instanceof HttpError && change.error.status === 429
        ? m.emailTooMany()
        : change.isError
          ? m.actionFailed()
          : undefined

  return (
    <>
      <Button variant="soft" tone="primary" onClick={() => setOpen(true)}>
        {m.passwordChange()}
      </Button>
      <Sheet open={open} onClose={close} title={m.passwordChange()}>
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          {/* Lets password managers update the saved entry for this account. */}
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <Input
            label={m.passwordCurrentLabel()}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <Input
            label={m.passwordNewLabel()}
            type="password"
            autoComplete="new-password"
            hint={m.passwordHint({ min: MIN_PASSWORD_LENGTH })}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          {error && <FormError>{error}</FormError>}
          <Button type="submit" block disabled={change.isPending || !current}>
            {m.passwordChange()}
          </Button>
        </form>
      </Sheet>
    </>
  )
}

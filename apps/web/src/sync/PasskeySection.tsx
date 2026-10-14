import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

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

const PASSKEYS_KEY = ['passkeys']

/** The signed-in account's passkeys: add one for this device, or remove old ones. */
export function PasskeySection() {
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: PASSKEYS_KEY, queryFn: listPasskeys })
  const [message, setMessage] = useState<string>()
  const refresh = () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY })

  const add = useMutation({
    mutationFn: () => addPasskey(m.passkeyDefaultName({ date: formatDate(Date.now()) })),
    onMutate: () => setMessage(undefined),
    onSuccess: async () => {
      await refresh()
      setMessage(m.passkeyAdded())
    },
    onError: (error) => {
      if (isPasskeyCancel(error)) return
      setMessage(needsFreshSignIn(error) ? m.passkeyNeedsFreshSignIn() : m.passkeyAddFailed())
    },
  })
  const remove = useMutation({
    mutationFn: deletePasskey,
    onMutate: () => setMessage(undefined),
    onSuccess: refresh,
    onError: () => setMessage(m.actionFailed()),
  })

  // A failed list (e.g. offline) still offers adding one.
  const passkeys: PasskeyInfo[] | undefined = list.isError ? [] : list.data
  if (!passkeysSupported() || !passkeys) return null

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
                disabled={remove.isPending}
                onClick={() => remove.mutate(item.id)}
              >
                {m.passkeyRemove()}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="soft" tone="primary" disabled={add.isPending} onClick={() => add.mutate()}>
        {m.passkeyAdd()}
      </Button>
      {message && <output className="m-0 font-bold">{message}</output>}
    </section>
  )
}

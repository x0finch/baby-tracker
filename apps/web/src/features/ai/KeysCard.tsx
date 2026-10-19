import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import {
  AI_PROVIDERS,
  type AiProvider,
  PROVIDER_LABEL,
  type ProviderModels,
  type UserAi,
  aiApi,
} from './api'
import { aiKeys } from './queries'
import { useSaved } from './use-saved'

/** A key per provider: whether it works, and adding or replacing it. */
export function KeysCard({ ai, providers }: { ai: UserAi; providers?: ProviderModels[] }) {
  const [editing, setEditing] = useState<AiProvider | null>(null)
  const [lastEditing, setLastEditing] = useState<AiProvider>('openai')
  const open = (provider: AiProvider) => {
    setEditing(provider)
    setLastEditing(provider)
  }
  return (
    <Card as="section" className="flex flex-col gap-1">
      <h2 className="m-0 text-body font-extrabold">{m.aiKeysTitle()}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {AI_PROVIDERS.map((provider) => {
          const key = ai.keys.find((item) => item.provider === provider)
          const status = providers?.find((item) => item.provider === provider)?.status
          return (
            <li
              key={provider}
              className="flex min-h-touch items-center gap-3 border-b-2 border-border py-2 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold">{PROVIDER_LABEL[provider]}</span>
                <KeyStatus hint={key?.keyHint} status={status} />
              </span>
              <Button variant="outline" onClick={() => open(provider)}>
                {key ? m.aiKeyReplace() : m.aiKeyAdd()}
              </Button>
            </li>
          )
        })}
      </ul>
      <p className="m-0 text-caption text-fg-muted">{m.aiKeysHint()}</p>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={m.aiKeySheetTitle({ provider: PROVIDER_LABEL[lastEditing] })}
      >
        {editing && (
          <KeyForm
            key={editing}
            provider={editing}
            saved={ai.keys.find((item) => item.provider === editing)?.keyHint}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Card>
  )
}

function KeyStatus({ hint, status }: { hint?: string; status?: ProviderModels['status'] }) {
  if (!hint) return <span className="text-caption text-fg-muted">{m.aiKeyNone()}</span>
  const [text, tone] =
    status === 'invalid'
      ? [m.aiKeyInvalidNow(), 'text-danger-text']
      : status === 'unreachable'
        ? [m.aiKeyUnreachable(), 'text-fg-muted']
        : status === 'ok'
          ? [m.aiKeyWorks(), 'text-primary-text']
          : ['', '']
  return (
    <span className="truncate text-caption text-fg-muted">
      {hint}
      {text && <span className={clsx('font-bold', tone)}>{` · ${text}`}</span>}
    </span>
  )
}

function KeyForm({
  provider,
  saved,
  onDone,
}: {
  provider: AiProvider
  saved?: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const onSaved = useSaved()
  const [apiKey, setApiKey] = useState('')
  const done = (next: UserAi) => {
    onSaved(next)
    void queryClient.invalidateQueries({ queryKey: aiKeys.models })
    onDone()
  }
  const save = useMutation({
    mutationFn: () => aiApi.saveKey(provider, apiKey.trim()),
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: () => aiApi.removeKey(provider), onSuccess: done })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (apiKey.trim()) save.mutate()
      }}
    >
      <Input
        label={m.aiKeyLabel()}
        type="password"
        autoComplete="off"
        placeholder={provider === 'openai' ? 'sk-…' : 'sk-or-…'}
        hint={saved ? m.aiKeyReplaces({ hint: saved }) : m.aiKeyPrivacy()}
        value={apiKey}
        onChange={(event) => {
          setApiKey(event.target.value)
          save.reset()
        }}
      />
      <Button type="submit" size="lg" block disabled={save.isPending || apiKey.trim() === ''}>
        {save.isPending ? m.aiChecking() : m.aiKeySave()}
      </Button>
      {save.isError && <FormError>{m.aiKeyInvalid()}</FormError>}
      {saved && (
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {m.aiKeyRemove()}
        </Button>
      )}
      {remove.isError && <FormError>{m.actionFailed()}</FormError>}
    </form>
  )
}

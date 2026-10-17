import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { formatDate, formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import {
  DEFAULT_PHRASE,
  SHORTCUT_URL,
  type VoicePreview,
  type VoiceSettings,
  copyWhenReady,
  voiceApi,
  voiceKeys,
} from './api'

/** The settings row's status: whether Siri can add records for this account. */
export function useVoiceSummary() {
  const { userId } = useAccess()
  const { data } = useQuery({
    queryKey: voiceKeys.settings,
    queryFn: voiceApi.settings,
    enabled: Boolean(userId),
  })
  if (!userId) return m.settingsNeedsSignIn()
  return data?.token ? m.voiceSummaryOn() : m.voiceSummaryOff()
}

/** Siri voice logging in settings: signed-in users only, as records go to the server. */
export function VoiceCard() {
  const { userId } = useAccess()
  if (!userId) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{m.voiceSignedOut()}</p>
      </Card>
    )
  }
  return <Voice />
}

function Voice() {
  const { data: settings, isError } = useQuery({
    queryKey: voiceKeys.settings,
    queryFn: voiceApi.settings,
  })
  if (!settings) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{isError ? m.voiceLoadFailed() : m.joinLoading()}</p>
      </Card>
    )
  }
  return (
    <>
      <PhraseCard settings={settings} />
      <ConnectCard settings={settings} />
      <Card>
        <p className="m-0 text-caption text-fg-muted">{m.voiceBackTap()}</p>
      </Card>
      <TryCard />
    </>
  )
}

/** What the user says to Siri; the shortcut must carry the same name. */
function PhraseCard({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState(settings.phrase)
  const save = useMutation({
    mutationFn: voiceApi.setPhrase,
    onSuccess: (next) => queryClient.setQueryData(voiceKeys.settings, next),
  })
  const shown = phrase.trim() || DEFAULT_PHRASE
  return (
    <Card className="flex flex-col gap-2">
      <Input
        label={m.voicePhraseLabel()}
        value={phrase}
        maxLength={20}
        onChange={(event) => setPhrase(event.target.value)}
        onBlur={() => {
          const next = phrase.trim() || DEFAULT_PHRASE
          setPhrase(next)
          if (next !== settings.phrase) save.mutate(next)
        }}
      />
      <p className="m-0 text-fg-muted">{m.voiceSay({ phrase: shown })}</p>
      {save.isError && <FormError>{m.actionFailed()}</FormError>}
    </Card>
  )
}

/** Adds the shortcut: creates a code, copies it and opens the shortcut to paste it into. */
function ConnectCard({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: voiceKeys.settings })
  const add = useMutation({
    mutationFn: async () => {
      const token = voiceApi.createToken().then((created) => created.token)
      await copyWhenReady(token)
      window.location.assign(SHORTCUT_URL)
    },
    onSettled: refresh,
  })
  const revoke = useMutation({ mutationFn: voiceApi.revokeToken, onSettled: refresh })
  const renamed = settings.phrase !== DEFAULT_PHRASE

  const steps = (
    <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-fg-muted">
      <li>{m.voiceStepCopy()}</li>
      <li>{m.voiceStepPaste()}</li>
      {renamed && <li>{m.voiceStepRename({ phrase: settings.phrase })}</li>}
    </ol>
  )

  if (!settings.token) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="m-0">{m.voiceIntro()}</p>
        {steps}
        <Button size="lg" block disabled={add.isPending} onClick={() => add.mutate()}>
          {m.voiceAdd()}
        </Button>
        {add.isError && <FormError>{m.actionFailed()}</FormError>}
      </Card>
    )
  }

  const { createdAt, lastUsedAt } = settings.token
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="font-extrabold text-primary-text">{m.voiceConnected()}</span>
        <span className="text-caption text-fg-muted">
          {[
            m.voiceAddedOn({ date: formatDate(createdAt) }),
            lastUsedAt
              ? m.voiceLastUsed({ time: `${formatDate(lastUsedAt)} ${formatTime(lastUsedAt)}` })
              : m.voiceNeverUsed(),
          ].join(' · ')}
        </span>
      </div>
      <p className="m-0 text-caption text-fg-muted">{m.voiceReaddHint()}</p>
      <Button variant="outline" block disabled={add.isPending} onClick={() => add.mutate()}>
        {m.voiceReadd()}
      </Button>
      <Button
        variant="ghost"
        tone="danger"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
      >
        {m.voiceRevoke()}
      </Button>
      {(add.isError || revoke.isError) && <FormError>{m.actionFailed()}</FormError>}
    </Card>
  )
}

/** Shows what a sentence would record, without recording anything. */
function TryCard() {
  const [text, setText] = useState('')
  const preview = useMutation<VoicePreview, Error, string>({ mutationFn: voiceApi.preview })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) preview.mutate(text.trim())
  }
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="m-0 text-body font-extrabold">{m.voiceTryTitle()}</h2>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Input
          label={m.voiceTryLabel()}
          placeholder={m.voiceTryPlaceholder()}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="outline" block disabled={preview.isPending || !text.trim()}>
          {m.voiceTry()}
        </Button>
      </form>
      {preview.data && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface p-3">
          <p className="m-0 font-bold">{preview.data.reply}</p>
          {preview.data.records.length > 0 && (
            <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-fg-muted">
              {preview.data.records.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {preview.isError && <FormError>{m.actionFailed()}</FormError>}
      <p className="m-0 text-caption text-fg-muted">{m.voiceTryHint()}</p>
    </Card>
  )
}

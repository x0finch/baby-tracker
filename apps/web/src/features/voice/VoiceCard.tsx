import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { formatDate, formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { requestSync } from '../../sync/runner'
import { useAccess } from '../../sync/use-access'
import {
  type ChatMessage,
  type ChatTurn,
  type VoiceSettings,
  copyWhenReady,
  shortcutImportUrl,
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
      <AiStatus settings={settings} />
      <Card as="section" className="flex flex-col gap-3">
        <p className="m-0">{m.voiceIntro()}</p>
        <PhraseInput settings={settings} />
        <Connect settings={settings} />
      </Card>
      {settings.ai && <ChatCard />}
      <Card>
        <p className="m-0 text-caption text-fg-muted">{m.voiceBackTap()}</p>
      </Card>
    </>
  )
}

/** Whose AI the commands use, and how to record in more families. */
function AiStatus({ settings }: { settings: VoiceSettings }) {
  const { ai } = settings
  if (ai?.kind === 'own') return null
  const link = (
    <Link to="/settings/ai" className="font-bold underline">
      {m.aiMineTitle()}
    </Link>
  )
  return (
    <Card tone="feeding">
      <p className="m-0">
        {ai ? m.voiceAiShared({ by: ai.by, family: ai.familyName }) : m.voiceAiNone()} {link}
      </p>
    </Card>
  )
}

/** Opens the chat box. */
function ChatCard() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="flex flex-col gap-2">
      <Button variant="outline" block onClick={() => setOpen(true)}>
        {m.voiceChatOpen()}
      </Button>
      <p className="m-0 text-caption text-fg-muted">{m.voiceChatHint()}</p>
      <ChatSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}

/** What the user says to Siri; the shortcut must carry the same name. */
function PhraseInput({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState(settings.phrase)
  const save = useMutation({
    mutationFn: voiceApi.rename,
    onSuccess: (next) => queryClient.setQueryData(voiceKeys.settings, next),
    onError: () => setPhrase(settings.phrase),
  })
  return (
    <div className="flex flex-col gap-2">
      <Input
        label={m.voicePhraseLabel()}
        value={phrase}
        maxLength={20}
        onChange={(event) => setPhrase(event.target.value)}
        onBlur={() => {
          const next = phrase.trim()
          if (!next) setPhrase(settings.phrase)
          else if (next !== settings.phrase) save.mutate(next)
        }}
      />
      <p className="m-0 text-fg-muted">{m.voiceSay({ phrase: settings.phrase })}</p>
      {save.isError && <FormError>{m.actionFailed()}</FormError>}
    </div>
  )
}

/** Adds the shortcut: creates a code, copies it and opens Shortcuts to import it with the code. */
function Connect({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: voiceKeys.settings })
  const add = useMutation({
    mutationFn: async () => {
      const token = voiceApi.createToken().then((created) => created.token)
      await copyWhenReady(token)
      window.location.assign(shortcutImportUrl(settings.phrase))
    },
    onSettled: refresh,
  })
  const revoke = useMutation({ mutationFn: voiceApi.revokeToken, onSettled: refresh })

  if (!settings.token) {
    return (
      <>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-fg-muted">
          <li>{m.voiceStepCopy()}</li>
          <li>{m.voiceStepPaste()}</li>
        </ol>
        <Button
          size="lg"
          block
          disabled={!settings.ai || add.isPending}
          onClick={() => add.mutate()}
        >
          {m.voiceAdd()}
        </Button>
        {add.isError && <FormError>{m.actionFailed()}</FormError>}
      </>
    )
  }

  const { createdAt, lastUsedAt } = settings.token
  return (
    <>
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
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={add.isPending}
          onClick={() => add.mutate()}
        >
          {m.voiceReadd()}
        </Button>
        <Button
          variant="ghost"
          tone="danger"
          className="flex-1"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate()}
        >
          {m.voiceRevoke()}
        </Button>
      </div>
      {(add.isError || revoke.isError) && <FormError>{m.actionFailed()}</FormError>}
    </>
  )
}

/**
 * Talks to the family's assistant as Siri would, in the same conversation: what is said here
 * is really recorded, and Siri remembers it for the next half hour.
 */
function ChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const key = voiceKeys.chat
  const { data: messages = [], isError } = useQuery({
    queryKey: key,
    queryFn: voiceApi.chat,
    enabled: open,
  })
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)

  const append = (message: Omit<ChatMessage, 'id'>) =>
    queryClient.setQueryData<ChatMessage[]>(key, (current = []) => [
      ...current,
      { ...message, id: crypto.randomUUID() },
    ])
  const send = useMutation<ChatTurn, Error, string>({
    mutationFn: voiceApi.send,
    onMutate: (said) => append({ role: 'user', text: said }),
    onSuccess: (turn) => {
      append({ role: 'assistant', text: turn.reply })
      setConfirming(turn.confirming)
      // The agent writes on the server; pull now so the records show without waiting.
      void requestSync()
    },
  })
  const say = (said: string) => {
    if (!said || send.isPending) return
    setText('')
    send.mutate(said)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    say(text.trim())
  }

  return (
    <Sheet open={open} onClose={onClose} title={m.voiceChatTitle()}>
      <div className="flex flex-col gap-3">
        <div className="flex min-h-40 flex-col gap-2">
          {messages.length === 0 && !send.isPending && (
            <p className="m-0 text-fg-muted">
              {isError ? m.voiceLoadFailed() : m.voiceChatEmpty()}
            </p>
          )}
          {messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {send.isPending && <p className="m-0 text-caption text-fg-muted">{m.voiceThinking()}</p>}
          {/* Remounts as the conversation grows, keeping the latest message in view. */}
          <div
            key={`${messages.length}-${send.isPending}`}
            ref={(node) => node?.scrollIntoView({ block: 'end' })}
          />
        </div>
        {confirming && !send.isPending && (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => say(m.voiceYes())}>
              {m.voiceYes()}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => say(m.voiceNo())}>
              {m.voiceNo()}
            </Button>
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={submit}>
          <div className="flex-1">
            <Input
              label={m.voiceChatLabel()}
              placeholder={m.voiceChatPlaceholder()}
              value={text}
              maxLength={300}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={send.isPending || !text.trim()}>
            {m.voiceChatSend()}
          </Button>
        </form>
        {send.isError && <FormError>{m.actionFailed()}</FormError>}
      </div>
    </Sheet>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    <p
      className={
        mine
          ? 'm-0 max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3 py-2 text-on-accent'
          : 'm-0 max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-3 py-2'
      }
    >
      {message.text}
    </p>
  )
}

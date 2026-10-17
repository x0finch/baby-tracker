import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { HttpError } from '../../lib/api'
import { formatDate, formatTime } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import {
  type ChatMessage,
  type ChatTurn,
  SHORTCUT_URL,
  type VoiceShortcut,
  copyWhenReady,
  voiceApi,
  voiceKeys,
} from './api'

/** The settings row's status: how many of the user's Siri shortcuts are connected. */
export function useVoiceSummary() {
  const { userId } = useAccess()
  const { data } = useQuery({
    queryKey: voiceKeys.settings,
    queryFn: voiceApi.settings,
    enabled: Boolean(userId),
  })
  if (!userId) return m.settingsNeedsSignIn()
  const connected = data?.shortcuts.filter((shortcut) => shortcut.token).length ?? 0
  return connected > 0 ? m.voiceSummaryOn() : m.voiceSummaryOff()
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
  if (settings.shortcuts.length === 0) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{m.voiceNoFamily()}</p>
      </Card>
    )
  }
  const several = settings.shortcuts.length > 1
  return (
    <>
      <Card>
        <p className="m-0">{m.voiceIntro()}</p>
        {several && <p className="m-0 mt-2 text-fg-muted">{m.voiceSeveralHint()}</p>}
      </Card>
      {settings.shortcuts.map((shortcut) => (
        <ShortcutCard key={shortcut.familyId} shortcut={shortcut} titled={several} />
      ))}
      <Card>
        <p className="m-0 text-caption text-fg-muted">{m.voiceBackTap()}</p>
      </Card>
    </>
  )
}

/** One family's shortcut: what to say, adding it to Siri, and a chat to try it. */
function ShortcutCard({ shortcut, titled }: { shortcut: VoiceShortcut; titled: boolean }) {
  const [chatting, setChatting] = useState(false)
  return (
    <Card as="section" className="flex flex-col gap-3">
      {titled && <h2 className="m-0 text-body font-extrabold">{shortcut.familyName}</h2>}
      {shortcut.hasAi ? (
        <>
          <PhraseInput shortcut={shortcut} />
          <Connect shortcut={shortcut} />
          <Button variant="outline" block onClick={() => setChatting(true)}>
            {m.voiceChatOpen()}
          </Button>
          <ChatSheet shortcut={shortcut} open={chatting} onClose={() => setChatting(false)} />
        </>
      ) : (
        <p className="m-0 rounded-lg bg-feeding-soft p-3">{m.voiceNeedsAi()}</p>
      )}
    </Card>
  )
}

/** What the user says to Siri; the shortcut must carry the same name. */
function PhraseInput({ shortcut }: { shortcut: VoiceShortcut }) {
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState(shortcut.phrase)
  const save = useMutation({
    mutationFn: (next: string) => voiceApi.rename(shortcut.familyId, next),
    onSuccess: (next) => queryClient.setQueryData(voiceKeys.settings, next),
    onError: () => setPhrase(shortcut.phrase),
  })
  const duplicate = save.error instanceof HttpError && save.error.status === 409
  return (
    <div className="flex flex-col gap-2">
      <Input
        label={m.voicePhraseLabel()}
        value={phrase}
        maxLength={20}
        onChange={(event) => setPhrase(event.target.value)}
        onBlur={() => {
          const next = phrase.trim()
          if (!next) setPhrase(shortcut.phrase)
          else if (next !== shortcut.phrase) save.mutate(next)
        }}
      />
      <p className="m-0 text-fg-muted">{m.voiceSay({ phrase: shortcut.phrase })}</p>
      {save.isError && <FormError>{duplicate ? m.voicePhraseTaken() : m.actionFailed()}</FormError>}
    </div>
  )
}

/** Adds the shortcut: creates a code, copies it and opens the shortcut to paste it into. */
function Connect({ shortcut }: { shortcut: VoiceShortcut }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: voiceKeys.settings })
  const add = useMutation({
    mutationFn: async () => {
      const token = voiceApi.createToken(shortcut.familyId).then((created) => created.token)
      await copyWhenReady(token)
      window.location.assign(SHORTCUT_URL)
    },
    onSettled: refresh,
  })
  const revoke = useMutation({
    mutationFn: () => voiceApi.revokeToken(shortcut.familyId),
    onSettled: refresh,
  })

  if (!shortcut.token) {
    return (
      <>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-fg-muted">
          <li>{m.voiceStepCopy()}</li>
          <li>{m.voiceStepPaste()}</li>
          <li>{m.voiceStepRename({ phrase: shortcut.phrase })}</li>
        </ol>
        <Button size="lg" block disabled={add.isPending} onClick={() => add.mutate()}>
          {m.voiceAdd()}
        </Button>
        {add.isError && <FormError>{m.actionFailed()}</FormError>}
      </>
    )
  }

  const { createdAt, lastUsedAt } = shortcut.token
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
function ChatSheet({
  shortcut,
  open,
  onClose,
}: {
  shortcut: VoiceShortcut
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const key = voiceKeys.chat(shortcut.familyId)
  const { data: messages = [], isError } = useQuery({
    queryKey: key,
    queryFn: () => voiceApi.chat(shortcut.familyId),
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
    mutationFn: (said) => voiceApi.send(shortcut.familyId, said),
    onMutate: (said) => append({ role: 'user', text: said }),
    onSuccess: (turn) => {
      append({ role: 'assistant', text: turn.reply })
      setConfirming(turn.confirming)
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
        <p className="m-0 text-caption text-fg-muted">{m.voiceChatHint()}</p>
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

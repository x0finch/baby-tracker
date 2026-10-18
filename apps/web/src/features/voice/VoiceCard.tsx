import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

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
  type ChatPage,
  SHORTCUT_NAME,
  type ChatTurn,
  type VoiceSettings,
  copyWhenReady,
  openShortcut,
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

/** Adds the shortcut: first the steps, then a code is copied and the shortcut opened. */
function Connect({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: voiceKeys.settings })
  const [guide, setGuide] = useState(false)
  const add = useMutation({
    mutationFn: async () => {
      const token = voiceApi.createToken().then((created) => created.token)
      await copyWhenReady(token)
      openShortcut()
    },
    onSuccess: () => setGuide(false),
    onSettled: refresh,
  })
  const revoke = useMutation({ mutationFn: voiceApi.revokeToken, onSettled: refresh })

  const guideSheet = (
    <Sheet open={guide} onClose={() => setGuide(false)} title={m.voiceAdd()}>
      <div className="flex flex-col gap-4">
        <ol className="m-0 flex list-decimal flex-col gap-3 pl-5">
          <li>{m.voiceGuideCopy()}</li>
          <li>{m.voiceGuideGet()}</li>
          <li>{m.voiceGuidePaste()}</li>
          {settings.phrase !== SHORTCUT_NAME && (
            <li>{m.voiceStepRename({ name: SHORTCUT_NAME, phrase: settings.phrase })}</li>
          )}
          <li>{m.voiceGuideTry({ phrase: settings.phrase })}</li>
        </ol>
        {settings.token && <p className="m-0 text-caption text-fg-muted">{m.voiceReaddHint()}</p>}
        <Button size="lg" block disabled={add.isPending} onClick={() => add.mutate()}>
          {m.voiceGuideGo()}
        </Button>
        {add.isError && <FormError>{m.actionFailed()}</FormError>}
      </div>
    </Sheet>
  )

  if (!settings.token) {
    return (
      <>
        <Button size="lg" block disabled={!settings.ai} onClick={() => setGuide(true)}>
          {m.voiceAdd()}
        </Button>
        {guideSheet}
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
      {/* Shortcuts may stay on its add sheet although it added the shortcut: a first try settles it. */}
      {!lastUsedAt && <p className="m-0 text-caption text-fg-muted">{m.voiceTryNow()}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setGuide(true)}>
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
      {revoke.isError && <FormError>{m.actionFailed()}</FormError>}
      {guideSheet}
    </>
  )
}

const dayOf = (time: number) => new Date(time).toDateString()

/** "今天 21:30", "昨天 08:05", "10月3日 14:20": when a conversation started. */
function startedLabel(at: number) {
  const time = formatTime(at)
  if (dayOf(at) === dayOf(Date.now())) return m.voiceChatToday({ time })
  if (dayOf(at) === dayOf(Date.now() - 86_400_000)) return m.voiceChatYesterday({ time })
  return `${formatDate(at)} ${time}`
}

/**
 * Talks to the family's assistant as Siri would, in the same conversation: what is said here
 * is really recorded, and Siri remembers it for the next half hour. Shows the latest
 * messages; scrolling up loads earlier ones, back 30 days.
 */
function ChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const key = voiceKeys.chat
  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => voiceApi.chat(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
    enabled: open,
  })
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)

  // Pages go back in time; the list reads oldest first.
  const pages = history.data?.pages ?? []
  const messages = pages.toReversed().flatMap((page) => page.lines)
  const threads: ChatPage['threads'] = {}
  for (const page of pages) Object.assign(threads, page.threads)
  const activeThreadId = pages[0]?.activeThreadId ?? null
  const lastThreadId = messages.findLast((message) => message.threadId)?.threadId ?? null
  // The latest conversation is over: the next message starts afresh.
  const ended = lastThreadId !== null && lastThreadId !== activeThreadId

  /** Shows a message before the server has it, at the end of the latest page. */
  const append = (message: Omit<ChatMessage, 'id' | 'threadId'>) =>
    queryClient.setQueryData<InfiniteData<ChatPage, string | null>>(key, (data) => {
      if (!data) return data
      const [latest, ...rest] = data.pages
      if (!latest) return data
      const line = { ...message, id: crypto.randomUUID(), threadId: null }
      return { ...data, pages: [{ ...latest, lines: [...latest.lines, line] }, ...rest] }
    })
  const send = useMutation<ChatTurn, Error, string>({
    mutationFn: voiceApi.send,
    onMutate: (said) => append({ role: 'user', text: said }),
    onSuccess: (turn) => {
      append({ role: 'assistant', text: turn.reply })
      setConfirming(turn.confirming)
      // The agent writes on the server; pull now so the records show without waiting.
      void requestSync()
    },
    // Back in step with the server: which conversation the messages went to.
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
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

  // Reaching the top loads the page before, keeping what is on screen where it was.
  const anchor = useRef<{ height: number; top: number } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = history
  const top = useCallback(
    (node: HTMLDivElement | null) => {
      const root = node?.closest('dialog')
      if (!node || !root) return undefined
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting || !hasNextPage || isFetchingNextPage) return
          anchor.current = { height: root.scrollHeight, top: root.scrollTop }
          void fetchNextPage()
        },
        { root },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )
  // Runs when a page is added: that is when the anchor applies.
  useLayoutEffect(() => {
    const root = list.current?.closest('dialog')
    if (!anchor.current || !root) return
    root.scrollTop = anchor.current.top + root.scrollHeight - anchor.current.height
    anchor.current = null
    // Keyed on the page count on purpose: the anchor applies once the new page is drawn.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [pages.length])

  const newConversation = (
    <p key="new" className="m-0 text-center text-caption font-bold text-fg-muted">
      {m.voiceChatNew()}
    </p>
  )
  const rows = messages.flatMap((message, index) => {
    const previous = messages[index - 1]
    const before: ReactNode[] = []
    if (message.threadId && message.threadId !== previous?.threadId) {
      const started = threads[message.threadId]?.startedAt
      if (started !== undefined) {
        before.push(
          <p key={`d-${message.threadId}`} className="m-0 text-center text-caption text-fg-muted">
            {startedLabel(started)}
          </p>,
        )
      }
    }
    if (ended && !message.threadId && previous?.threadId) before.push(newConversation)
    return [...before, <Bubble key={message.id} message={message} />]
  })
  if (ended && messages.at(-1)?.threadId) rows.push(newConversation)

  return (
    <Sheet open={open} onClose={onClose} title={m.voiceChatTitle()}>
      <div className="flex flex-col gap-3">
        <div ref={list} className="flex min-h-40 flex-col gap-2">
          {hasNextPage ? (
            <div ref={top} className="text-center text-caption text-fg-muted">
              {isFetchingNextPage ? m.voiceChatLoadingEarlier() : '\u00a0'}
            </div>
          ) : (
            messages.length > 0 && (
              <p className="m-0 text-center text-caption text-fg-muted">{m.voiceChatOldest()}</p>
            )
          )}
          {messages.length === 0 && !send.isPending && (
            <p className="m-0 text-fg-muted">
              {history.isError ? m.voiceLoadFailed() : m.voiceChatEmpty()}
            </p>
          )}
          {rows}
          {send.isPending && <p className="m-0 text-caption text-fg-muted">{m.voiceThinking()}</p>}
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
          <div className="min-w-0 flex-1">
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
        {/* Remounts when a message is added at the end, keeping it and the input in view. */}
        <div
          key={`${messages.at(-1)?.id}-${send.isPending}`}
          ref={(node) => node?.scrollIntoView({ block: 'end' })}
        />
      </div>
    </Sheet>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    // Long unbroken text (a link, an id) wraps instead of widening the sheet.
    <p
      className={clsx(
        'm-0 max-w-[85%] rounded-2xl px-3 py-2 wrap-anywhere',
        mine
          ? 'self-end rounded-br-md bg-primary text-on-accent'
          : 'self-start rounded-bl-md bg-surface',
      )}
    >
      {message.text}
    </p>
  )
}

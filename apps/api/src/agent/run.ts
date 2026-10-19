import { newId } from '@bobo/shared'
import {
  type AnyTextAdapter,
  EventType,
  type RunAgentResumeItem,
  chat,
  maxIterations,
} from '@tanstack/ai'
import {
  clearToolResults,
  composeStrategies,
  evictOldest,
  withCompaction,
} from '@tanstack/ai-compaction'
import { withPersistence } from '@tanstack/ai-persistence'
import { z } from 'zod'

import type { Access, FamilyAccess } from '../access'
import { describe, formatClock, localNow } from '../voice/plan'
import { eventsByIds, writableBabies } from './data'
import { chatPersistence } from './persistence'
import { type AgentContext, agentTools } from './tools'

/** A conversation continues while the user comes back within this long. */
export const SESSION_IDLE_MS = 30 * 60_000
/** Model calls per message: enough to look something up, act on it and answer. */
const MAX_STEPS = 6
/** A whole turn, every model call in it, gets this long: Siri does not wait much longer. */
export const TURN_TIMEOUT_MS = 25_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const answerSchema = z.object({ answer: z.enum(['yes', 'no', 'other']) })

/**
 * How the user answered "要修改…吗？", in whatever words or language: yes, no, or null when
 * they said something else ("不是五点，是六点"), which is then a new message.
 */
async function answerTo(
  adapter: AnyTextAdapter,
  scope: AgentScope,
  question: string,
  text: string,
  abortController: AbortController,
): Promise<'yes' | 'no' | null> {
  try {
    const { answer } = await chat({
      adapter,
      abortController,
      modelOptions: scope.modelOptions,
      systemPrompts: [
        'The user was asked to confirm a change to a baby record. Decide whether their reply approves it (yes), refuses it (no), or says something else, such as a correction or a new request (other). The reply may be in any language.',
      ],
      messages: [{ role: 'user', content: `Question: ${question}\nReply: ${text}` }],
      outputSchema: answerSchema,
    })
    return answer === 'other' ? null : answer
  } catch (error) {
    // Unsure: the change is not made, and the reply is handled as a new message.
    console.error('Reading the answer failed', error)
    return null
  }
}

/** A model that writes its tool calls as text (DeepSeek's DSML) instead of calling them. */
const RAW_TOOL_CALL = /｜DSML｜|<\|tool|<\/?(invoke|function_calls|tool_call)\b/

export interface AgentTurn {
  /** What to say back. */
  reply: string
  /** The user said they're finished, or nothing more can be done. */
  done: boolean
  /** A change is waiting for the user's yes or no. */
  confirming: boolean
}

export interface AgentScope {
  db: D1Database
  access: Access
  /** The families the key in use may record for. */
  families: FamilyAccess[]
  /** Recording only for the family that shared its AI: the user has no key of their own. */
  sharedOnly: boolean
  /**
   * Whose key and which families the conversation runs with. A change starts a new
   * conversation, so what was said with one key never goes to another key's provider.
   */
  keyScope: string
  userId: string
  timeZone: string
  phrase: string
  /** Extra request fields for the provider (modelOptionsFor). */
  modelOptions?: Record<string, unknown>
  /** Overrides TURN_TIMEOUT_MS; tests use a short one. */
  timeoutMs?: number
}

function instructions(scope: AgentScope, now: number, babyNames: string[]) {
  const family = scope.families[0]
  const limit =
    scope.sharedOnly && family
      ? `\n- 现在用的是「${family.alias ?? family.name}」分享的 AI，只能记这个家庭的宝宝。家长要给别的家庭记，就请家长在 Bobo 的 设置 → 我的 AI 里填自己的 key。`
      : ''
  return `你是 Bobo 的育儿记录助手。家长通过 Siri 或 App 跟你说话，你用工具查看和记录宝宝的喂养、睡眠、尿布等。
规则：
- 用中文回答，口语化、简短（一两句），因为常常是 Siri 读出来的。不要用列表或 Markdown。
- 能直接记就直接记，不要反复确认。一句话里的几件事用一次 record 调用。
- 修改或删除前先用 find_events 找到那条记录。修改直接调用 update_event，不用问家长，改完用一句话说清改了什么（改之前和改之后）。删除调用 delete_event，系统会自动请家长确认，你不用自己问。
- 回答问题时先用 find_events 查，再根据结果回答，不要编造。
- 记完或答完后，问一句"还有吗？"。家长说没有了、好了、谢谢，就调用 end_conversation 并简短道别。
- 能记录的宝宝：${babyNames.join('、') || '（还没有宝宝）'}。括号里是家庭名，用于区分重名的宝宝，记录时要带上。没说名字且只有一个宝宝时就是这个宝宝。${limit}
- 现在是 ${localNow(now, scope.timeZone)}。`
}

/** Every thread of a user starts with this, so deleting the account can find them all. */
export const threadPrefix = (userId: string) => `voice_${userId}_`

/** The thread the user's next message goes to: the current one, or a new one after a pause. */
export async function currentThread(db: D1Database, scope: AgentScope, now: number) {
  const row = await db
    .prepare(
      `select thread_id as threadId, thread_active_at as activeAt, thread_scope as keyScope
       from voice_settings where user_id = ?`,
    )
    .bind(scope.userId)
    .first<{ threadId: string | null; activeAt: number | null; keyScope: string | null }>()
  const fresh =
    !row?.threadId ||
    row.activeAt === null ||
    now - row.activeAt > SESSION_IDLE_MS ||
    row.keyScope !== scope.keyScope
  const threadId = fresh ? `${threadPrefix(scope.userId)}${newId(now)}` : (row.threadId ?? '')
  await db
    .prepare(
      `insert into voice_settings (user_id, phrase, time_zone, thread_id, thread_active_at,
         thread_scope, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?5)
       on conflict (user_id) do update set thread_id = excluded.thread_id,
         thread_active_at = excluded.thread_active_at, thread_scope = excluded.thread_scope`,
    )
    .bind(scope.userId, scope.phrase, scope.timeZone, threadId, now, scope.keyScope)
    .run()
  return threadId
}

/** "要删除「小米粒 10:32 换尿布（尿尿）」吗？" for a change waiting for approval. */
async function confirmQuestion(scope: AgentScope, metadata: Record<string, unknown>) {
  const toolName = metadata.toolName
  const input = metadata.input
  const id =
    typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string'
      ? input.id
      : ''
  const [event] = await eventsByIds(scope.db, [id])
  const babies = await writableBabies(scope.db, scope.families)
  // Nothing about a record outside the user's babies, whatever id the model passed.
  const baby = event && babies.find((item) => item.id === event.babyId)
  const what =
    event && baby
      ? `${baby.name} ${formatClock(event.startAt, scope.timeZone)} ${describe(event, null)}`
      : '这条记录'
  return toolName === 'delete_event' ? `要删除「${what}」吗？` : `要修改「${what}」吗？`
}

interface RunOutcome {
  text: string
  /** Approvals the run stopped for, with what they would do. */
  approvals: Array<Record<string, unknown>>
  error: string | null
}

async function runChat(
  adapter: AnyTextAdapter,
  ctx: AgentContext,
  scope: AgentScope,
  input: { messages: Array<{ role: 'user'; content: string }> } | { resume: RunAgentResumeItem[] },
  babyNames: string[],
  abortController: AbortController,
): Promise<RunOutcome> {
  let text = ''
  const approvals: Array<Record<string, unknown>> = []
  let error: string | null = null
  const options = {
    adapter,
    threadId: ctx.threadId,
    runId: ctx.runId,
    systemPrompts: [instructions(scope, ctx.now, babyNames)],
    tools: agentTools(ctx),
    abortController,
    modelOptions: scope.modelOptions,
    agentLoopStrategy: maxIterations(MAX_STEPS),
    middleware: [
      withPersistence(chatPersistence(scope.db)),
      withCompaction({
        maxTokens: 12_000,
        strategy: composeStrategies(clearToolResults(), evictOldest()),
      }),
    ],
  }
  const stream =
    'messages' in input
      ? chat({ ...options, messages: input.messages })
      : chat({ ...options, messages: [], resume: input.resume })
  try {
    for await (const chunk of stream) {
      if (chunk.type === EventType.TEXT_MESSAGE_START) text = ''
      if (chunk.type === EventType.TEXT_MESSAGE_CONTENT) text += chunk.delta
      if (chunk.type === EventType.RUN_ERROR) error = chunk.message
      if (chunk.type === EventType.RUN_FINISHED && chunk.outcome?.type === 'interrupt') {
        for (const interrupt of chunk.outcome.interrupts) {
          if (interrupt.metadata) approvals.push(interrupt.metadata)
        }
      }
    }
  } catch (thrown) {
    if (!abortController.signal.aborted) throw thrown
  }
  // Out of time: whatever was said so far is not an answer.
  if (abortController.signal.aborted) error = 'timed out'
  return { text: text.trim(), approvals, error }
}

/**
 * One message from the user. While a change waits for approval, the model reads whether the
 * message approves or refuses it; anything else refuses it and is then handled as a new
 * message.
 */
export async function runAgent(
  adapter: AnyTextAdapter,
  scope: AgentScope,
  text: string,
  now: number,
): Promise<AgentTurn> {
  const threadId = await currentThread(scope.db, scope, now)
  const state = { done: false }
  const context = (): AgentContext => ({
    ...scope,
    threadId,
    runId: `run_${newId(Date.now())}`,
    now,
    state,
  })
  const babyNames = (await writableBabies(scope.db, scope.families)).map((baby) => baby.name)
  const persistence = chatPersistence(scope.db)
  const pending = await persistence.stores.interrupts.listPending(threadId)
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), scope.timeoutMs ?? TURN_TIMEOUT_MS)
  try {
    let outcome: RunOutcome | null = null
    if (pending.length > 0) {
      const metadata = pending[0]?.payload.metadata
      const question = isRecord(metadata)
        ? await confirmQuestion(scope, metadata)
        : '要修改这条记录吗？'
      const answer = await answerTo(adapter, scope, question, text, abort)
      const approved = answer === 'yes'
      // The question named only the first change: a yes approves that one, never the others.
      const resume: RunAgentResumeItem[] = pending.map((item, index) => ({
        interruptId: item.interruptId,
        status: 'resolved',
        payload: { approved: approved && index === 0 },
      }))
      outcome = await runChat(adapter, context(), scope, { resume }, babyNames, abort)
      if (answer === null) outcome = null
    }
    outcome ??= await runChat(
      adapter,
      context(),
      scope,
      { messages: [{ role: 'user', content: text }] },
      babyNames,
      abort,
    )

    if (outcome.error || RAW_TOOL_CALL.test(outcome.text)) {
      if (!outcome.error)
        console.error('Model wrote a tool call as text', outcome.text.slice(0, 200))
      return { reply: '没处理好，请再说一遍。', done: false, confirming: false }
    }
    const first = outcome.approvals[0]
    if (first) return { reply: await confirmQuestion(scope, first), done: false, confirming: true }
    return { reply: outcome.text || '好的。', done: state.done, confirming: false }
  } finally {
    clearTimeout(timer)
  }
}

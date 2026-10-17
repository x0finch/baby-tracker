import { newId } from '@bobo/shared'
import { type AnyTextAdapter, chat, maxIterations } from '@tanstack/ai'
import {
  clearToolResults,
  composeStrategies,
  evictOldest,
  withCompaction,
} from '@tanstack/ai-compaction'
import { withPersistence } from '@tanstack/ai-persistence'

import type { Access, FamilyAccess } from '../access'
import { describe, formatClock, localNow } from '../voice/plan'
import { eventsByIds, writableBabies } from './data'
import { chatPersistence } from './persistence'
import { type AgentContext, agentTools } from './tools'

/** A conversation continues while the user comes back within this long. */
export const SESSION_IDLE_MS = 30 * 60_000
/** Model calls per message: enough to look something up, act on it and answer. */
const MAX_STEPS = 6

const YES = /^(对|是|是的|确定|确认|好|好的|可以|行|嗯|没错|删吧|删掉|改吧|改吧)[。！!.，, 吧的]*$/
const NO = /^(不|不要|不用|别|算了|取消|不对|错了)[。！!.，, 吧了]*$/

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
  family: FamilyAccess
  userId: string
  timeZone: string
  phrase: string
}

function instructions(scope: AgentScope, now: number, babyNames: string[]) {
  return `你是 Bobo 的育儿记录助手。家长通过 Siri 或 App 跟你说话，你用工具查看和记录宝宝的喂养、睡眠、尿布等。
规则：
- 用中文回答，口语化、简短（一两句），因为常常是 Siri 读出来的。不要用列表或 Markdown。
- 能直接记就直接记，不要反复确认。一句话里的几件事用一次 record 调用。
- 修改或删除前先用 find_events 找到那条记录，再调用 update_event 或 delete_event；系统会自动请家长确认，你不用自己问。
- 回答问题时先用 find_events 查，再根据结果回答，不要编造。
- 记完或答完后，问一句"还有吗？"。家长说没有了、好了、谢谢，就调用 end_conversation 并简短道别。
- 只能记录这个家庭的宝宝：${babyNames.join('、') || '（还没有宝宝）'}。没说名字且只有一个宝宝时就是这个宝宝。
- 现在是 ${localNow(now, scope.timeZone)}。`
}

/** The thread the user's next message goes to: the current one, or a new one after a pause. */
export async function currentThread(db: D1Database, scope: AgentScope, now: number) {
  const row = await db
    .prepare(
      `select thread_id as threadId, thread_active_at as activeAt from voice_shortcuts
       where user_id = ? and family_id = ?`,
    )
    .bind(scope.userId, scope.family.id)
    .first<{ threadId: string | null; activeAt: number | null }>()
  const fresh = !row?.threadId || row.activeAt === null || now - row.activeAt > SESSION_IDLE_MS
  const threadId = fresh ? `voice_${newId(now)}` : (row.threadId ?? '')
  await db
    .prepare(
      `insert into voice_shortcuts (user_id, family_id, phrase, time_zone, thread_id, thread_active_at, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       on conflict (user_id, family_id) do update set
         thread_id = excluded.thread_id, thread_active_at = excluded.thread_active_at`,
    )
    .bind(scope.userId, scope.family.id, scope.phrase, scope.timeZone, threadId, now)
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
  const babies = await writableBabies(scope.db, scope.family)
  const what = event
    ? `${babies.find((baby) => baby.id === event.babyId)?.name ?? ''} ${formatClock(event.startAt, scope.timeZone)} ${describe(event, null)}`
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
  input: { messages: Array<{ role: 'user'; content: string }> } | { resume: unknown[] },
  babyNames: string[],
): Promise<RunOutcome> {
  let text = ''
  const approvals: Array<Record<string, unknown>> = []
  let error: string | null = null
  const stream = chat({
    adapter,
    threadId: ctx.threadId,
    runId: ctx.runId,
    systemPrompts: [instructions(scope, ctx.now, babyNames)],
    tools: agentTools(ctx),
    agentLoopStrategy: maxIterations(MAX_STEPS),
    middleware: [
      withPersistence(chatPersistence(scope.db)),
      withCompaction({
        maxTokens: 12_000,
        strategy: composeStrategies(clearToolResults(), evictOldest()),
      }),
    ],
    ...('messages' in input
      ? { messages: input.messages }
      : { messages: [], resume: input.resume }),
  } as Parameters<typeof chat>[0])
  for await (const chunk of stream as AsyncIterable<{ type: string } & Record<string, unknown>>) {
    if (chunk.type === 'TEXT_MESSAGE_START') text = ''
    if (chunk.type === 'TEXT_MESSAGE_CONTENT' && typeof chunk.delta === 'string')
      text += chunk.delta
    if (chunk.type === 'RUN_ERROR') {
      const message = chunk.error
      error =
        typeof message === 'object' && message !== null && 'message' in message
          ? String(message.message)
          : 'error'
    }
    if (chunk.type === 'RUN_FINISHED') {
      const outcome = chunk.outcome
      if (
        typeof outcome === 'object' &&
        outcome !== null &&
        'interrupts' in outcome &&
        Array.isArray(outcome.interrupts)
      ) {
        for (const interrupt of outcome.interrupts) {
          if (typeof interrupt === 'object' && interrupt !== null && 'metadata' in interrupt) {
            approvals.push(interrupt.metadata as Record<string, unknown>)
          }
        }
      }
    }
  }
  return { text: text.trim(), approvals, error }
}

/**
 * One message from the user. A change waiting for approval is approved by "对" and the like,
 * refused by "不" and the like; anything else refuses it and is then handled as a new message.
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
  const babyNames = (await writableBabies(scope.db, scope.family)).map((baby) => baby.name)
  const persistence = chatPersistence(scope.db)
  const pending = await persistence.stores.interrupts.listPending(threadId)

  let outcome: RunOutcome | null = null
  if (pending.length > 0) {
    const approved = YES.test(text.trim())
    const resume = pending.map((item) => ({
      interruptId: item.interruptId,
      status: 'resolved',
      payload: { approved },
    }))
    outcome = await runChat(adapter, context(), scope, { resume }, babyNames)
    if (!approved && !NO.test(text.trim())) outcome = null
  }
  outcome ??= await runChat(
    adapter,
    context(),
    scope,
    { messages: [{ role: 'user', content: text }] },
    babyNames,
  )

  if (outcome.error) return { reply: '没处理好，请再说一遍。', done: false, confirming: false }
  const first = outcome.approvals[0]
  if (first) return { reply: await confirmQuestion(scope, first), done: false, confirming: true }
  return { reply: outcome.text || '好的。', done: state.done, confirming: false }
}

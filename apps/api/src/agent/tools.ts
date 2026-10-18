import { type Event, eventSchema } from '@bobo/shared'
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

import type { Access, FamilyAccess } from '../access'
import { voiceActionSchema } from '../voice/action'
import { type VoiceBaby, clockToTime, describe, formatClock, planActions } from '../voice/plan'
import {
  type Change,
  eventsByIds,
  recentEvents,
  runningEvents,
  undoLastTurn,
  writableBabies,
  writeChanges,
} from './data'

/** Everything a turn's tools act on: one user, their families, one thread. */
export interface AgentContext {
  db: D1Database
  access: Access
  /** The families this turn may act in. */
  families: FamilyAccess[]
  userId: string
  threadId: string
  runId: string
  now: number
  timeZone: string
  /** Set by end_conversation: the shortcut stops asking. */
  state: { done: boolean }
}

const resultSchema = z.object({ ok: z.boolean(), message: z.string() })
const EVENT_TYPES = [
  'feeding',
  'sleep',
  'diaper',
  'pumping',
  'temperature',
  'medication',
  'note',
  'growth',
] as const

function line(event: Event, before: Event | null, babies: VoiceBaby[], timeZone: string) {
  const name = babies.find((baby) => baby.id === event.babyId)?.name ?? ''
  const at = before && event.endAt !== null && before.endAt === null ? event.endAt : event.startAt
  return `${name} ${formatClock(at, timeZone)} ${describe(event, before)}`
}

const REFUSED: Record<string, string> = {
  forbidden: '没有权限做这个操作。',
  family_mismatch: '这条记录不属于这个家庭。',
}

/** The tools for one turn, bound to its context. */
export function agentTools(ctx: AgentContext) {
  const { db, access, families, userId, now, timeZone } = ctx
  const babies = () => writableBabies(db, families)
  const log = { threadId: ctx.threadId, runId: ctx.runId }

  /** One of the family's events, if the user may see it. */
  async function ownEvent(id: string) {
    const [event] = await eventsByIds(db, [id])
    const known = await babies()
    return event && event.deletedAt === null && known.some((baby) => baby.id === event.babyId)
      ? { event, known }
      : null
  }

  const listBabies = toolDefinition({
    name: 'list_babies',
    description: "The family's babies, and any sleep or breastfeed timer still running.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      babies: z.array(z.object({ name: z.string(), running: z.array(z.string()) })),
    }),
  }).server(async () => {
    const known = await babies()
    const running = await runningEvents(db, known)
    return {
      babies: known.map((baby) => ({
        name: baby.name,
        running: running
          .filter((event) => event.babyId === baby.id)
          .map((event) => line(event, null, known, timeZone)),
      })),
    }
  })

  const findEvents = toolDefinition({
    name: 'find_events',
    description:
      'Recent records, newest first, with ids for update_event and delete_event. Use it to ' +
      'answer questions ("上次喂奶是什么时候", "今天喝了多少") and to find a record to change.',
    inputSchema: z.object({
      baby: z.string().nullable().meta({ description: 'Baby name, or null for all' }),
      type: z.enum(EVENT_TYPES).nullable(),
      hours: z
        .number()
        .min(1)
        .max(24 * 14)
        .meta({ description: 'How far back to look' }),
    }),
    outputSchema: z.object({
      events: z.array(z.object({ id: z.string(), date: z.string(), summary: z.string() })),
    }),
  }).server(async ({ baby, type, hours }) => {
    const known = await babies()
    const chosen = baby ? known.filter((item) => item.name.includes(baby)) : known
    const events = await recentEvents(
      db,
      chosen.map((item) => item.id),
      now - hours * 3_600_000,
      type,
      50,
    )
    return {
      events: events.map((event) => ({
        id: event.id,
        date: new Intl.DateTimeFormat('zh-CN', {
          timeZone,
          month: 'numeric',
          day: 'numeric',
        }).format(event.startAt),
        summary: line(event, null, known, timeZone),
      })),
    }
  })

  const record = toolDefinition({
    name: 'record',
    description:
      'Add records, or start and stop timers (type sleep starts a sleep, wake ends it). Use ' +
      'one call for everything said in one sentence.',
    inputSchema: z.object({ actions: z.array(voiceActionSchema).min(1) }),
    outputSchema: resultSchema,
  }).server(async ({ actions }) => {
    const known = await babies()
    const running = await runningEvents(db, known)
    const plan = planActions(
      actions.filter((action) => action.type !== 'undo'),
      {
        babies: known,
        runningSleeps: new Map(
          running.filter((event) => event.type === 'sleep').map((event) => [event.babyId, event]),
        ),
        userId,
        now,
        timeZone,
      },
    )
    if (plan.kind !== 'changes')
      return { ok: false, message: plan.kind === 'reply' ? plan.reply : '' }
    const refused = await writeChanges(db, access, userId, log, plan.changes, now)
    if (refused) return { ok: false, message: REFUSED[refused] ?? refused }
    return { ok: true, message: `已记录：${plan.lines.join('；')}` }
  })

  const updateEvent = toolDefinition({
    name: 'update_event',
    description:
      'Change one record (its id from find_events). Only the fields given change. Needs the ' +
      "user's approval, which they give in their next message.",
    inputSchema: z.object({
      id: z.string(),
      time: z.string().nullable().meta({ description: 'New start time, HH:MM' }),
      endTime: z.string().nullable().meta({ description: 'New end time for timed records, HH:MM' }),
      amountMl: z.number().nullable(),
      diaper: z.enum(['wet', 'dirty', 'mixed']).nullable(),
      note: z.string().nullable(),
    }),
    outputSchema: resultSchema,
    needsApproval: true,
  }).server(async ({ id, time, endTime, amountMl, diaper, note }) => {
    const found = await ownEvent(id)
    if (!found) return { ok: false, message: '找不到这条记录。' }
    const { event, known } = found
    const at = (clock: string | null) => (clock ? clockToTime(clock, now, timeZone) : null)
    const next: Record<string, unknown> = { ...event, updatedAt: now }
    const startAt = at(time)
    if (startAt !== null) next.startAt = startAt
    const endAt = at(endTime)
    if (endAt !== null) next.endAt = endAt
    if (note !== null) next.note = note.trim() || null
    if (
      amountMl !== null &&
      (event.type === 'pumping' || (event.type === 'feeding' && event.data.kind === 'bottle'))
    ) {
      next.data = { ...event.data, amountMl: Math.round(amountMl) }
    }
    if (diaper !== null && event.type === 'diaper') {
      next.data = { contents: diaper, ...(diaper === 'dirty' ? {} : { pee: { amount: 'normal' } }) }
    }
    const parsed = eventSchema.safeParse(next)
    if (!parsed.success) return { ok: false, message: '这样改不行，请换个说法。' }
    const change: Change = { event: parsed.data, before: event }
    const refused = await writeChanges(db, access, userId, log, [change], now)
    if (refused) return { ok: false, message: REFUSED[refused] ?? refused }
    return { ok: true, message: `已修改：${line(parsed.data, null, known, timeZone)}` }
  })

  const deleteEvent = toolDefinition({
    name: 'delete_event',
    description:
      "Delete one record (its id from find_events). Needs the user's approval, which they " +
      'give in their next message.',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: resultSchema,
    needsApproval: true,
  }).server(async ({ id }) => {
    const found = await ownEvent(id)
    if (!found) return { ok: false, message: '找不到这条记录。' }
    const { event, known } = found
    const change: Change = { event: { ...event, deletedAt: now, updatedAt: now }, before: event }
    const refused = await writeChanges(db, access, userId, log, [change], now)
    if (refused) return { ok: false, message: REFUSED[refused] ?? refused }
    return { ok: true, message: `已删除：${line(event, null, known, timeZone)}` }
  })

  const undo = toolDefinition({
    name: 'undo',
    description: 'Undo what the latest change in this conversation did ("撤销", "记错了").',
    inputSchema: z.object({}),
    outputSchema: resultSchema,
  }).server(async () => {
    const known = await babies()
    const babyIds = new Set(known.map((baby) => baby.id))
    const result = await undoLastTurn(db, access, userId, ctx.threadId, babyIds, now)
    if ('refused' in result)
      return { ok: false, message: REFUSED[result.refused] ?? result.refused }
    if (result.reverted.length === 0) return { ok: false, message: '没有可以撤销的操作。' }
    return {
      ok: true,
      message: `已撤销：${result.reverted.map((event) => line(event, null, known, timeZone)).join('；')}`,
    }
  })

  const endConversation = toolDefinition({
    name: 'end_conversation',
    description:
      'Call when the user is finished ("没有了", "好了", "谢谢") or nothing more can be done, ' +
      'then say a short goodbye.',
    inputSchema: z.object({}),
    outputSchema: z.object({ ended: z.boolean() }),
  }).server(async () => {
    ctx.state.done = true
    return { ended: true }
  })

  return [listBabies, findEvents, record, updateEvent, deleteEvent, undo, endConversation]
}

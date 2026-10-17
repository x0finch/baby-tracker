import { type Event, inBabyScope } from '@bobo/shared'
import { Hono } from 'hono'
import { z } from 'zod'

import { type Access, checkEventWrite, loadAccess } from '../access'
import type { Env } from '../env'
import { json } from '../http'
import { parseEvent } from '../sync/protocol'
import { bumpSeq, upsertEvents } from '../sync/sql'
import type { AppEnv } from '../types'
import type { VoiceParser } from '../voice/parse'
import { type PlannedChange, REPLY, type VoiceBaby, localNow, planActions } from '../voice/plan'
import { createToken, revokeTokens, tokenStatus, useToken } from '../voice/tokens'

export const DEFAULT_PHRASE = '记录宝宝'
const DEFAULT_ZONE = 'Asia/Shanghai'
/** "撤销" only reaches the last command, and only for a while. */
const UNDO_WINDOW_MS = 30 * 60_000
const MAX_TEXT = 300

export type VoiceParserFor = (env: Env) => VoiceParser | null

const isTimeZone = (zone: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone !== ''
  } catch {
    return false
  }
}

const timeZoneSchema = z.string().max(64).refine(isTimeZone)
const settingsPatchSchema = z.object({
  phrase: z.string().trim().min(1).max(20).optional(),
  timeZone: timeZoneSchema.optional(),
})
const tokenCreateSchema = z.object({ timeZone: timeZoneSchema.optional() })
const textSchema = z.object({ text: z.string().trim().min(1).max(MAX_TEXT) })

const REPLIES = {
  invalidToken: '口令已失效，请到 Bobo 的设置 → Siri 语音记录里重新添加。',
  limited: '今天说得太多次了，明天再试吧。',
  slowDown: '说得太快了，请稍等一下再试。',
  unavailable: '语音记录暂时不可用，请稍后再试。',
  forbidden: (name: string) => `你没有权限给${name}添加记录。`,
  nothingToUndo: '没有可以撤销的记录。',
}

async function readSettings(db: D1Database, userId: string) {
  const row = await db
    .prepare('select phrase, time_zone as timeZone from voice_settings where user_id = ?')
    .bind(userId)
    .first<{ phrase: string; timeZone: string }>()
  return row ?? { phrase: DEFAULT_PHRASE, timeZone: DEFAULT_ZONE }
}

function saveSettings(
  db: D1Database,
  userId: string,
  phrase: string,
  timeZone: string,
  now: number,
) {
  return db
    .prepare(
      `insert into voice_settings (user_id, phrase, time_zone, updated_at) values (?, ?, ?, ?)
       on conflict (user_id) do update set
         phrase = excluded.phrase, time_zone = excluded.time_zone, updated_at = excluded.updated_at`,
    )
    .bind(userId, phrase, timeZone, now)
}

type EventRow = Omit<Event, 'data'> & { data: string }

const EVENT_COLUMNS = `id, baby_id as babyId, family_id as familyId, type, start_at as startAt,
  end_at as endAt, data, note, created_at as createdAt, updated_at as updatedAt,
  deleted_at as deletedAt, created_by as createdBy`

function toEvents(rows: EventRow[]): Event[] {
  return rows.flatMap((row) => {
    const event = parseEvent({ ...row, data: JSON.parse(row.data) })
    return event ? [event] : []
  })
}

/** Babies the user may add records for: not archived, in a family where they can write. */
async function writableBabies(db: D1Database, access: Access): Promise<VoiceBaby[]> {
  const families = [...access.values()].filter((family) => family.role !== 'viewer')
  if (families.length === 0) return []
  const { results } = await db
    .prepare(
      `select id, name, family_id as familyId from babies
       where family_id in (select value from json_each(?))
         and deleted_at is null and archived_at is null order by created_at`,
    )
    .bind(JSON.stringify(families.map((family) => family.id)))
    .all<VoiceBaby>()
  return results.filter((baby) => inBabyScope(access.get(baby.familyId)?.babyIds ?? null, baby.id))
}

async function runningSleeps(db: D1Database, babies: VoiceBaby[]) {
  if (babies.length === 0) return new Map<string, Event>()
  const { results } = await db
    .prepare(
      `select ${EVENT_COLUMNS} from events
       where baby_id in (select value from json_each(?)) and type = 'sleep'
         and end_at is null and deleted_at is null order by start_at`,
    )
    .bind(JSON.stringify(babies.map((baby) => baby.id)))
    .all<EventRow>()
  return new Map(toEvents(results).map((event) => [event.babyId, event]))
}

interface VoiceResult {
  reply: string
  /** One line per record, for the settings page's preview. */
  records: string[]
}

const reply = (text: string): VoiceResult => ({ reply: text, records: [] })

function permitted(access: Access, changes: PlannedChange[], babies: VoiceBaby[], userId: string) {
  for (const { event, before } of changes) {
    if (checkEventWrite(access, event, before ?? undefined, userId)) {
      const name = babies.find((baby) => baby.id === event.babyId)?.name ?? '这个宝宝'
      return REPLIES.forbidden(name)
    }
  }
  return null
}

/** Puts back what the last voice command changed, if it was recent enough. */
async function undoLast(
  db: D1Database,
  access: Access,
  userId: string,
  now: number,
  write: boolean,
) {
  const row = await db
    .prepare('select changes, created_at as createdAt from voice_undo where user_id = ?')
    .bind(userId)
    .first<{ changes: string; createdAt: number }>()
  if (!row || now - row.createdAt > UNDO_WINDOW_MS) return reply(REPLIES.nothingToUndo)
  const saved = z
    .object({
      lines: z.array(z.string()),
      changes: z.array(z.object({ id: z.string(), before: z.unknown() })),
    })
    .safeParse(JSON.parse(row.changes))
  if (!saved.success) return reply(REPLIES.nothingToUndo)
  const text = `已撤销：${saved.data.lines.join('；')}`
  if (!write) return { reply: `会撤销：${saved.data.lines.join('；')}`, records: [] }

  const { results } = await db
    .prepare(`select ${EVENT_COLUMNS} from events where id in (select value from json_each(?))`)
    .bind(JSON.stringify(saved.data.changes.map((change) => change.id)))
    .all<EventRow>()
  const current = new Map(toEvents(results).map((event) => [event.id, event]))
  const restored: Event[] = []
  for (const change of saved.data.changes) {
    const stored = current.get(change.id)
    if (!stored) continue
    const before = change.before === null ? null : parseEvent(change.before)
    const next = before
      ? { ...before, updatedAt: now }
      : { ...stored, deletedAt: now, updatedAt: now }
    if (checkEventWrite(access, next, stored, userId)) return reply(REPLIES.nothingToUndo)
    restored.push(next)
  }
  await db.batch([
    bumpSeq(db),
    ...(restored.length > 0 ? [upsertEvents(db, restored)] : []),
    db.prepare('delete from voice_undo where user_id = ?').bind(userId),
  ])
  return reply(text)
}

/** Understands a sentence and, when `write` is set, records it. */
async function runVoice(
  env: Env,
  parser: VoiceParser,
  userId: string,
  text: string,
  now: number,
  write: boolean,
): Promise<VoiceResult> {
  const db = env.DB
  const [settings, access] = await Promise.all([readSettings(db, userId), loadAccess(db, userId)])
  const babies = await writableBabies(db, access)
  const parsed = await parser({
    text,
    babyNames: babies.map((baby) => baby.name),
    localNow: localNow(now, settings.timeZone),
  })
  if (parsed.unclear) return reply(REPLY.unclear)

  const plan = planActions(parsed.actions, {
    babies,
    runningSleeps: await runningSleeps(db, babies),
    userId,
    now,
    timeZone: settings.timeZone,
  })
  if (plan.kind === 'reply') return reply(plan.reply)
  if (plan.kind === 'undo') return undoLast(db, access, userId, now, write)

  const refused = permitted(access, plan.changes, babies, userId)
  if (refused) return reply(refused)
  const summary = plan.lines.join('；')
  if (!write) return { reply: `会记录：${summary}`, records: plan.lines }

  const undo = {
    lines: plan.lines,
    changes: plan.changes.map(({ event, before }) => ({ id: event.id, before })),
  }
  await db.batch([
    bumpSeq(db),
    upsertEvents(
      db,
      plan.changes.map((change) => change.event),
    ),
    db
      .prepare(
        `insert into voice_undo (user_id, changes, created_at) values (?, ?, ?)
         on conflict (user_id) do update set changes = excluded.changes, created_at = excluded.created_at`,
      )
      .bind(userId, JSON.stringify(undo), now),
  ])
  return { reply: `已记录：${summary}`, records: plan.lines }
}

/** Settings page: the phrase, the code, and a preview. Needs a session. */
export function voiceRoutes(parserFor: VoiceParserFor) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      const userId = c.get('user').id
      const now = Date.now()
      const [settings, token] = await Promise.all([
        readSettings(c.env.DB, userId),
        tokenStatus(c.env.DB, userId, now),
      ])
      return c.json({ phrase: settings.phrase, token: token ?? null })
    })
    .patch('/', json(settingsPatchSchema), async (c) => {
      const userId = c.get('user').id
      const patch = c.req.valid('json')
      const current = await readSettings(c.env.DB, userId)
      const next = { ...current, ...patch }
      await saveSettings(c.env.DB, userId, next.phrase, next.timeZone, Date.now()).run()
      const token = await tokenStatus(c.env.DB, userId, Date.now())
      return c.json({ phrase: next.phrase, token: token ?? null })
    })
    .post('/token', json(tokenCreateSchema), async (c) => {
      const userId = c.get('user').id
      const now = Date.now()
      const { timeZone } = c.req.valid('json')
      if (timeZone) {
        const current = await readSettings(c.env.DB, userId)
        await saveSettings(c.env.DB, userId, current.phrase, timeZone, now).run()
      }
      return c.json(await createToken(c.env.DB, userId, now))
    })
    .delete('/token', async (c) => {
      await revokeTokens(c.env.DB, c.get('user').id, c.req.query('id')).run()
      return c.body(null, 204)
    })
    .post('/preview', json(textSchema), async (c) => {
      const parser = parserFor(c.env)
      if (!parser) return c.json(reply(REPLIES.unavailable), 503)
      const { text } = c.req.valid('json')
      return c.json(await runVoice(c.env, parser, c.get('user').id, text, Date.now(), false))
    })
}

/**
 * What the Siri shortcut calls, with its code instead of a session. Always answers with
 * `{ reply }`, which the shortcut reads aloud.
 */
export function siriRoutes(parserFor: VoiceParserFor) {
  return new Hono<AppEnv>().post('/', async (c) => {
    const now = Date.now()
    const check = await useToken(c.env.DB, c.req.header('Authorization'), now)
    if (check.status === 'invalid') return c.json(reply(REPLIES.invalidToken), 401)
    if (check.status === 'limited') return c.json(reply(REPLIES.limited), 429)
    const burst = await c.env.VOICE_RATE_LIMIT?.limit({ key: check.token.id })
    if (burst && !burst.success) return c.json(reply(REPLIES.slowDown), 429)

    const body = textSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json(reply('没听清，请再说一遍。'), 400)
    const parser = parserFor(c.env)
    if (!parser) return c.json(reply(REPLIES.unavailable), 503)
    try {
      return c.json(await runVoice(c.env, parser, check.token.userId, body.data.text, now, true))
    } catch (error) {
      console.error('Voice command failed', error)
      return c.json(reply(REPLIES.unavailable), 500)
    }
  })
}

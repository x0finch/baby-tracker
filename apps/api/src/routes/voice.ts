import { type Event, inBabyScope } from '@bobo/shared'
import { Hono } from 'hono'
import { z } from 'zod'

import { type Access, type FamilyAccess, checkEventWrite, loadAccess } from '../access'
import type { Env } from '../env'
import { fail, json } from '../http'
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

/** The parser for a family's own AI settings, or null when the family has none. */
export type VoiceParserFor = (env: Env, familyId: string) => Promise<VoiceParser | null>

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
  familyId: z.string().max(64).optional(),
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
  noAi: '这个家庭还没设置 AI 模型，请家庭的创建者或管理员在 Bobo 里设置。',
}

interface Settings {
  phrase: string
  familyId: string | null
  timeZone: string
}

async function readSettings(db: D1Database, userId: string): Promise<Settings> {
  const row = await db
    .prepare(
      `select phrase, family_id as familyId, time_zone as timeZone from voice_settings
       where user_id = ?`,
    )
    .bind(userId)
    .first<Settings>()
  return row ?? { phrase: DEFAULT_PHRASE, familyId: null, timeZone: DEFAULT_ZONE }
}

function saveSettings(db: D1Database, userId: string, settings: Settings, now: number) {
  return db
    .prepare(
      `insert into voice_settings (user_id, phrase, family_id, time_zone, updated_at)
       values (?, ?, ?, ?, ?)
       on conflict (user_id) do update set phrase = excluded.phrase,
         family_id = excluded.family_id, time_zone = excluded.time_zone,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, settings.phrase, settings.familyId, settings.timeZone, now)
}

/** Families the user can record for (not as a viewer), in the order they joined. */
const recordingFamilies = (access: Access) =>
  [...access.values()].filter((family) => family.role !== 'viewer')

/**
 * The one family Siri records for: the chosen one while the user can still record there,
 * else their first. Its AI parses the command and only its babies can be recorded, so a
 * family's key is never spent on another family.
 */
function siriFamily(access: Access, settings: Settings) {
  const families = recordingFamilies(access)
  return families.find((family) => family.id === settings.familyId) ?? families[0]
}

/** What the settings page shows. */
async function settingsView(db: D1Database, userId: string, now: number) {
  const [settings, access, token] = await Promise.all([
    readSettings(db, userId),
    loadAccess(db, userId),
    tokenStatus(db, userId, now),
  ])
  const families = recordingFamilies(access)
  const { results } = await db
    .prepare(
      'select family_id as familyId from family_ai where family_id in (select value from json_each(?))',
    )
    .bind(JSON.stringify(families.map((family) => family.id)))
    .all<{ familyId: string }>()
  const withAi = new Set(results.map((row) => row.familyId))
  return {
    phrase: settings.phrase,
    token: token ?? null,
    families: families.map((family) => ({
      id: family.id,
      name: family.alias ?? family.name,
      hasAi: withAi.has(family.id),
    })),
    familyId: siriFamily(access, settings)?.id ?? null,
  }
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

/** The family's babies the user may record for: not archived, within their baby scope. */
async function writableBabies(db: D1Database, family: FamilyAccess): Promise<VoiceBaby[]> {
  const { results } = await db
    .prepare(
      `select id, name, family_id as familyId from babies
       where family_id = ? and deleted_at is null and archived_at is null order by created_at`,
    )
    .bind(family.id)
    .all<VoiceBaby>()
  return results.filter((baby) => inBabyScope(family.babyIds, baby.id))
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
  parserFor: VoiceParserFor,
  userId: string,
  text: string,
  now: number,
  write: boolean,
): Promise<VoiceResult> {
  const db = env.DB
  const [settings, access] = await Promise.all([readSettings(db, userId), loadAccess(db, userId)])
  const family = siriFamily(access, settings)
  if (!family) return reply(REPLY.noBabies)
  const parser = await parserFor(env, family.id)
  if (!parser) return reply(REPLIES.noAi)
  const babies = await writableBabies(db, family)
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

/** Settings page: the phrase, the family, the code, and a preview. Needs a session. */
export function voiceRoutes(parserFor: VoiceParserFor) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await settingsView(c.env.DB, c.get('user').id, Date.now())))
    .patch('/', json(settingsPatchSchema), async (c) => {
      const db = c.env.DB
      const userId = c.get('user').id
      const { familyId, ...patch } = c.req.valid('json')
      const current = await readSettings(db, userId)
      if (familyId !== undefined) {
        const access = await loadAccess(db, userId)
        if (!recordingFamilies(access).some((family) => family.id === familyId)) fail('forbidden')
      }
      const next = { ...current, ...patch, familyId: familyId ?? current.familyId }
      await saveSettings(db, userId, next, Date.now()).run()
      return c.json(await settingsView(db, userId, Date.now()))
    })
    .post('/token', json(tokenCreateSchema), async (c) => {
      const db = c.env.DB
      const userId = c.get('user').id
      const now = Date.now()
      const { timeZone } = c.req.valid('json')
      if (timeZone) {
        const current = await readSettings(db, userId)
        await saveSettings(db, userId, { ...current, timeZone }, now).run()
      }
      return c.json(await createToken(db, userId, now))
    })
    .delete('/token', async (c) => {
      await revokeTokens(c.env.DB, c.get('user').id, c.req.query('id')).run()
      return c.body(null, 204)
    })
    .post('/preview', json(textSchema), async (c) => {
      // Each preview calls the model too.
      const burst = await c.env.VOICE_RATE_LIMIT?.limit({ key: c.get('user').id })
      if (burst && !burst.success) return c.json(reply(REPLIES.slowDown), 429)
      const { text } = c.req.valid('json')
      return c.json(await runVoice(c.env, parserFor, c.get('user').id, text, Date.now(), false))
    })
}

/** "That's all": ends a conversation without asking the model. */
const DONE_PHRASE =
  /^(没有了?|没了|没有别的了?|好了|结束|不用了|就这些|就这样|退出|拜拜)[。！!.，, ]*$/

/**
 * What the Siri shortcut calls, with its code instead of a session. Always answers 200 with
 * `{ ok, done, reply }`: Shortcuts may not read the body of an error response, which would
 * leave Siri silent. The shortcut reads `reply` aloud and asks "还有吗？" until `done`, which
 * is set when the user says they're finished or when asking again cannot help.
 */
export function siriRoutes(parserFor: VoiceParserFor) {
  return new Hono<AppEnv>().post('/', async (c) => {
    const answer = (result: VoiceResult, ok: boolean, done = false) =>
      c.json({ ok, done, ...result })
    const now = Date.now()
    const check = await useToken(c.env.DB, c.req.header('Authorization'), now)
    if (check.status === 'invalid') return answer(reply(REPLIES.invalidToken), false, true)
    if (check.status === 'limited') return answer(reply(REPLIES.limited), false, true)
    const burst = await c.env.VOICE_RATE_LIMIT?.limit({ key: check.token.id })
    if (burst && !burst.success) return answer(reply(REPLIES.slowDown), false, true)

    const body = textSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return answer(reply('没听清，请再说一遍。'), false)
    if (DONE_PHRASE.test(body.data.text)) return answer(reply('好的。'), true, true)
    try {
      const result = await runVoice(c.env, parserFor, check.token.userId, body.data.text, now, true)
      const recorded = result.records.length > 0 || result.reply.startsWith('已撤销')
      // Nothing to record for, or no model to understand: asking again cannot help.
      const stuck = result.reply === REPLIES.noAi || result.reply === REPLY.noBabies
      return answer(result, recorded, stuck)
    } catch (error) {
      console.error('Voice command failed', error)
      return answer(reply(REPLIES.unavailable), false, true)
    }
  })
}

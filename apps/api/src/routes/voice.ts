import type { AnyTextAdapter, ModelMessage } from '@tanstack/ai'
import { Hono } from 'hono'
import { z } from 'zod'

import { type Access, type FamilyAccess, loadAccess } from '../access'
import { chatPersistence } from '../agent/persistence'
import { type AgentScope, type AgentTurn, SESSION_IDLE_MS, runAgent } from '../agent/run'
import type { Env } from '../env'
import { fail, json } from '../http'
import type { AppEnv } from '../types'
import { createToken, revokeToken, tokenStatuses, useToken } from '../voice/tokens'

export const DEFAULT_PHRASE = '记录宝宝'
const DEFAULT_ZONE = 'Asia/Shanghai'
const MAX_TEXT = 300

/** The model for a family's own AI settings, or null when the family has none. */
export type AdapterFor = (env: Env, familyId: string) => Promise<AnyTextAdapter | null>

const isTimeZone = (zone: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone !== ''
  } catch {
    return false
  }
}

const timeZoneSchema = z.string().max(64).refine(isTimeZone)
const phraseSchema = z.object({ phrase: z.string().trim().min(1).max(20) })
const tokenCreateSchema = z.object({ timeZone: timeZoneSchema.optional() })
const textSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT),
  timeZone: timeZoneSchema.optional(),
})

const REPLIES = {
  invalidToken: '口令已失效，请到 Bobo 的设置 → Siri 语音记录里重新添加。',
  limited: '今天说得太多次了，明天再试吧。',
  slowDown: '说得太快了，请稍等一下再试。',
  unavailable: '语音记录暂时不可用，请稍后再试。',
  noAi: '这个家庭还没设置 AI 模型，请家庭的创建者或管理员在 Bobo 里设置。',
  noFamily: '你已经不在这个家庭里了，请到 Bobo 里重新添加 Siri。',
  viewer: '你在这个家庭里只能查看，不能记录。',
  unclear: '没听清，请再说一遍。',
}

const stop = (reply: string): AgentTurn => ({ reply, done: true, confirming: false })

/** Families the user can record for (not as a viewer), in the order they joined. */
const recordingFamilies = (access: Access) =>
  [...access.values()].filter((family) => family.role !== 'viewer')

interface ShortcutRow {
  familyId: string
  phrase: string
  timeZone: string
}

async function shortcutRows(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `select family_id as familyId, phrase, time_zone as timeZone from voice_shortcuts
       where user_id = ?`,
    )
    .bind(userId)
    .all<ShortcutRow>()
  return new Map(results.map((row) => [row.familyId, row]))
}

/** "记录宝宝" for the first family, "记录<家庭名>" for the others, until the user picks one. */
function defaultPhrase(families: FamilyAccess[], family: FamilyAccess) {
  return families[0]?.id === family.id ? DEFAULT_PHRASE : `记录${family.alias ?? family.name}`
}

/** Everything a turn needs, or the reply that explains why there is no turn. */
async function scopeFor(
  db: D1Database,
  userId: string,
  familyId: string,
  timeZone?: string,
): Promise<AgentScope | string> {
  const access = await loadAccess(db, userId)
  const family = access.get(familyId)
  if (!family) return REPLIES.noFamily
  if (family.role === 'viewer') return REPLIES.viewer
  const row = (await shortcutRows(db, userId)).get(familyId)
  return {
    db,
    access,
    family,
    userId,
    timeZone: timeZone ?? row?.timeZone ?? DEFAULT_ZONE,
    phrase: row?.phrase ?? defaultPhrase(recordingFamilies(access), family),
  }
}

/** What the settings page shows: one shortcut per family the user can record for. */
async function settingsView(db: D1Database, userId: string, now: number) {
  const [access, rows, tokens] = await Promise.all([
    loadAccess(db, userId),
    shortcutRows(db, userId),
    tokenStatuses(db, userId, now),
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
    shortcuts: families.map((family) => ({
      familyId: family.id,
      familyName: family.alias ?? family.name,
      phrase: rows.get(family.id)?.phrase ?? defaultPhrase(families, family),
      hasAi: withAi.has(family.id),
      token: tokens.get(family.id) ?? null,
    })),
  }
}

/** Saves the user's shortcut settings for a family, keeping its conversation. */
function saveShortcut(
  db: D1Database,
  userId: string,
  familyId: string,
  patch: { phrase: string; timeZone: string },
  now: number,
) {
  return db
    .prepare(
      `insert into voice_shortcuts (user_id, family_id, phrase, time_zone, updated_at)
       values (?, ?, ?, ?, ?)
       on conflict (user_id, family_id) do update set phrase = excluded.phrase,
         time_zone = excluded.time_zone, updated_at = excluded.updated_at`,
    )
    .bind(userId, familyId, patch.phrase, patch.timeZone, now)
    .run()
}

const messageText = (message: ModelMessage) =>
  typeof message.content === 'string'
    ? message.content
    : (message.content ?? []).map((part) => (part.type === 'text' ? part.content : '')).join('')

/** The current conversation, as the chat box shows it; empty once it has gone idle. */
async function transcript(db: D1Database, userId: string, familyId: string, now: number) {
  const row = await db
    .prepare(
      `select thread_id as threadId, thread_active_at as activeAt from voice_shortcuts
       where user_id = ? and family_id = ?`,
    )
    .bind(userId, familyId)
    .first<{ threadId: string | null; activeAt: number | null }>()
  if (!row?.threadId || row.activeAt === null || now - row.activeAt > SESSION_IDLE_MS) return []
  const persistence = chatPersistence(db)
  const messages = await persistence.stores.messages.loadThread(row.threadId)
  return messages.flatMap((message) => {
    if (message.role === 'tool') return []
    const text = messageText(message).trim()
    return text ? [{ role: message.role, text }] : []
  })
}

/** One message to the family's agent, from the chat box or Siri. */
async function turn(
  env: Env,
  adapterFor: AdapterFor,
  userId: string,
  familyId: string,
  text: string,
  now: number,
  timeZone?: string,
): Promise<AgentTurn> {
  const scope = await scopeFor(env.DB, userId, familyId, timeZone)
  if (typeof scope === 'string') return stop(scope)
  const adapter = await adapterFor(env, familyId)
  if (!adapter) return stop(REPLIES.noAi)
  return runAgent(adapter, scope, text, now)
}

/** Settings page and chat box. Needs a session. */
export function voiceRoutes(adapterFor: AdapterFor) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await settingsView(c.env.DB, c.get('user').id, Date.now())))
    .patch('/families/:familyId', json(phraseSchema), async (c) => {
      const db = c.env.DB
      const userId = c.get('user').id
      const familyId = c.req.param('familyId')
      const { phrase } = c.req.valid('json')
      const now = Date.now()
      const view = await settingsView(db, userId, now)
      if (!view.shortcuts.some((shortcut) => shortcut.familyId === familyId)) fail('forbidden')
      // Siri tells shortcuts apart by what the user says.
      if (view.shortcuts.some((other) => other.familyId !== familyId && other.phrase === phrase)) {
        return c.json({ error: 'duplicate_phrase' }, 409)
      }
      const row = (await shortcutRows(db, userId)).get(familyId)
      await saveShortcut(
        db,
        userId,
        familyId,
        { phrase, timeZone: row?.timeZone ?? DEFAULT_ZONE },
        now,
      )
      return c.json(await settingsView(db, userId, now))
    })
    .post('/families/:familyId/token', json(tokenCreateSchema), async (c) => {
      const db = c.env.DB
      const userId = c.get('user').id
      const familyId = c.req.param('familyId')
      const now = Date.now()
      const scope = await scopeFor(db, userId, familyId, c.req.valid('json').timeZone)
      if (typeof scope === 'string') fail('forbidden')
      await saveShortcut(db, userId, familyId, scope, now)
      return c.json(await createToken(db, userId, familyId, now))
    })
    .delete('/families/:familyId/token', async (c) => {
      await revokeToken(c.env.DB, c.get('user').id, { familyId: c.req.param('familyId') }).run()
      return c.body(null, 204)
    })
    .delete('/tokens/:id', async (c) => {
      await revokeToken(c.env.DB, c.get('user').id, { id: c.req.param('id') }).run()
      return c.body(null, 204)
    })
    .get('/families/:familyId/chat', async (c) =>
      c.json({
        messages: await transcript(c.env.DB, c.get('user').id, c.req.param('familyId'), Date.now()),
      }),
    )
    .post('/families/:familyId/chat', json(textSchema), async (c) => {
      const userId = c.get('user').id
      // Each message calls the model.
      const burst = await c.env.VOICE_RATE_LIMIT?.limit({ key: userId })
      if (burst && !burst.success) return c.json(stop(REPLIES.slowDown), 429)
      const { text, timeZone } = c.req.valid('json')
      try {
        return c.json(
          await turn(
            c.env,
            adapterFor,
            userId,
            c.req.param('familyId'),
            text,
            Date.now(),
            timeZone,
          ),
        )
      } catch (error) {
        console.error('Voice chat failed', error)
        return c.json(stop(REPLIES.unavailable), 503)
      }
    })
}

/**
 * What the Siri shortcut calls, with its code instead of a session. Always answers 200 with
 * `{ ok, done, confirming, reply }`: Shortcuts may not read the body of an error response,
 * which would leave Siri silent. The shortcut reads `reply` aloud and asks "还有吗？" until
 * `done`, which the agent sets when the user is finished, or the server when asking again
 * cannot help.
 */
export function siriRoutes(adapterFor: AdapterFor) {
  return new Hono<AppEnv>().post('/', async (c) => {
    const answer = (result: AgentTurn, ok: boolean) => c.json({ ok, ...result })
    const now = Date.now()
    const check = await useToken(c.env.DB, c.req.header('Authorization'), now)
    if (check.status === 'invalid') return answer(stop(REPLIES.invalidToken), false)
    if (check.status === 'limited') return answer(stop(REPLIES.limited), false)
    const burst = await c.env.VOICE_RATE_LIMIT?.limit({ key: check.token.id })
    if (burst && !burst.success) return answer(stop(REPLIES.slowDown), false)

    const body = textSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success)
      return answer({ reply: REPLIES.unclear, done: false, confirming: false }, false)
    try {
      const { userId, familyId } = check.token
      return answer(await turn(c.env, adapterFor, userId, familyId, body.data.text, now), true)
    } catch (error) {
      console.error('Voice command failed', error)
      return answer(stop(REPLIES.unavailable), false)
    }
  })
}

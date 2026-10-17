import { Hono } from 'hono'
import { z } from 'zod'

import { type FamilyEnv, familyManager, familyMember, loadAccess } from '../access'
import { readUserAi, sharedAis } from '../agent/keys'
import { fail, json } from '../http'
import type { AppEnv } from '../types'
import { AI_PROVIDERS, AiKeyError, decryptKey, encryptKey, keyHint, listModels } from '../voice/ai'

const keySchema = z.string().trim().min(8).max(300)
const modelsSchema = z.object({ provider: z.enum(AI_PROVIDERS), apiKey: keySchema.nullable() })
const saveSchema = modelsSchema.extend({ model: z.string().trim().min(1).max(120) })
const sharesSchema = z.object({ familyIds: z.array(z.string().max(64)).max(50) })
const chooseSchema = z.object({ userId: z.string().max(64) })

async function view(db: D1Database, userId: string) {
  const saved = await readUserAi(db, userId)
  if (!saved) return null
  const { results } = await db
    .prepare('select family_id as familyId from ai_shares where user_id = ? order by created_at')
    .bind(userId)
    .all<{ familyId: string }>()
  return {
    provider: saved.provider,
    model: saved.model,
    keyHint: saved.keyHint,
    sharedFamilyIds: results.map((row) => row.familyId),
  }
}

/**
 * The user's own AI model for voice logging, which they may share with their families. The
 * key goes in once and never comes back out; only its last characters are shown.
 */
export const userAiRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await view(c.env.DB, c.get('user').id)))
  .post('/models', json(modelsSchema), async (c) => {
    const secret = c.env.ENCRYPTION_SECRET
    if (!secret) return c.json({ error: 'not_configured' }, 503)
    const { provider, apiKey } = c.req.valid('json')
    let key = apiKey
    if (key === null) {
      // Checking again with the saved key, e.g. to pick another model.
      const saved = await readUserAi(c.env.DB, c.get('user').id)
      if (!saved || saved.provider !== provider) return c.json({ error: 'invalid_key' }, 400)
      key = await decryptKey(secret, saved.keyCipher)
    }
    try {
      return c.json({ models: await listModels(provider, key) })
    } catch (error) {
      if (error instanceof AiKeyError) return c.json({ error: 'invalid_key' }, 400)
      throw error
    }
  })
  .put('/', json(saveSchema), async (c) => {
    const secret = c.env.ENCRYPTION_SECRET
    if (!secret) return c.json({ error: 'not_configured' }, 503)
    const db = c.env.DB
    const userId = c.get('user').id
    const { provider, model, apiKey } = c.req.valid('json')
    const saved = await readUserAi(db, userId)
    let sealed: { keyCipher: string; keyHint: string }
    if (apiKey !== null)
      sealed = { keyCipher: await encryptKey(secret, apiKey), keyHint: keyHint(apiKey) }
    else if (saved && saved.provider === provider) sealed = saved
    else return c.json({ error: 'invalid_key' }, 400)
    await db
      .prepare(
        `insert into user_ai (user_id, provider, model, key_cipher, key_hint, updated_at)
         values (?, ?, ?, ?, ?, ?)
         on conflict (user_id) do update set provider = excluded.provider, model = excluded.model,
           key_cipher = excluded.key_cipher, key_hint = excluded.key_hint,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, provider, model, sealed.keyCipher, sealed.keyHint, Date.now())
      .run()
    return c.json(await view(db, userId))
  })
  .put('/shares', json(sharesSchema), async (c) => {
    const db = c.env.DB
    const userId = c.get('user').id
    if (!(await readUserAi(db, userId))) fail('not_found')
    const access = await loadAccess(db, userId)
    const { familyIds } = c.req.valid('json')
    if (familyIds.some((id) => !access.has(id))) fail('forbidden')
    const now = Date.now()
    await db.batch([
      db
        .prepare(
          `delete from ai_shares where user_id = ?1
           and family_id not in (select value from json_each(?2))`,
        )
        .bind(userId, JSON.stringify(familyIds)),
      ...familyIds.map((familyId) =>
        db
          .prepare(
            `insert into ai_shares (family_id, user_id, created_at) values (?, ?, ?)
             on conflict do nothing`,
          )
          .bind(familyId, userId, now),
      ),
    ])
    return c.json(await view(db, userId))
  })
  .delete('/', async (c) => {
    const db = c.env.DB
    const userId = c.get('user').id
    await db.batch([
      db.prepare('delete from ai_shares where user_id = ?').bind(userId),
      db.prepare('delete from user_ai where user_id = ?').bind(userId),
    ])
    return c.body(null, 204)
  })

async function familyView(db: D1Database, familyId: string) {
  const shared = await sharedAis(db, [familyId])
  const shares = shared.map(({ userId, name, provider, model }) => ({
    userId,
    name,
    provider,
    model,
  }))
  return { inUse: shares[0]?.userId ?? null, shares }
}

/**
 * The AIs members shared with a family, and which one it uses. Owners and admins pick it;
 * keys never leave the server.
 */
export const familyAiRoutes = new Hono<FamilyEnv>()
  .use(familyMember)
  .get('/', async (c) => c.json(await familyView(c.env.DB, c.req.param('familyId') ?? '')))
  .put('/', familyManager, json(chooseSchema), async (c) => {
    const db = c.env.DB
    const familyId = c.req.param('familyId') ?? ''
    const { userId } = c.req.valid('json')
    const current = await familyView(db, familyId)
    if (!current.shares.some((share) => share.userId === userId)) fail('forbidden')
    await db
      .prepare(
        `insert into family_ai (family_id, user_id, updated_by, updated_at) values (?, ?, ?, ?)
         on conflict (family_id) do update set user_id = excluded.user_id,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .bind(familyId, userId, c.get('user').id, Date.now())
      .run()
    return c.json(await familyView(db, familyId))
  })

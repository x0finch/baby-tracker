import { Hono } from 'hono'
import { z } from 'zod'

import { type FamilyEnv, familyManager, familyMember } from '../access'
import { json } from '../http'
import {
  AI_PROVIDERS,
  type AiProvider,
  AiKeyError,
  decryptKey,
  encryptKey,
  keyHint,
  listModels,
} from '../voice/ai'

const keySchema = z.string().trim().min(8).max(300)
const modelsSchema = z.object({ provider: z.enum(AI_PROVIDERS), apiKey: keySchema.nullable() })
const saveSchema = modelsSchema.extend({ model: z.string().trim().min(1).max(120) })

interface SavedAi {
  provider: AiProvider
  model: string
  keyCipher: string
  keyHint: string
}

export async function readFamilyAi(db: D1Database, familyId: string) {
  return db
    .prepare(
      `select provider, model, key_cipher as keyCipher, key_hint as keyHint from family_ai
       where family_id = ?`,
    )
    .bind(familyId)
    .first<SavedAi>()
}

/**
 * A family's AI model for voice logging, managed by its owner and admins. The key goes in
 * once and never comes back out; only its last characters are shown.
 */
export const familyAiRoutes = new Hono<FamilyEnv>()
  .use(familyMember, familyManager)
  .get('/', async (c) => {
    const saved = await readFamilyAi(c.env.DB, c.req.param('familyId') ?? '')
    return c.json(
      saved ? { provider: saved.provider, model: saved.model, keyHint: saved.keyHint } : null,
    )
  })
  .post('/models', json(modelsSchema), async (c) => {
    const secret = c.env.AI_KEY_SECRET
    if (!secret) return c.json({ error: 'not_configured' }, 503)
    const { provider, apiKey } = c.req.valid('json')
    let key = apiKey
    if (key === null) {
      // Checking again with the saved key, e.g. to pick another model.
      const saved = await readFamilyAi(c.env.DB, c.req.param('familyId') ?? '')
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
    const secret = c.env.AI_KEY_SECRET
    if (!secret) return c.json({ error: 'not_configured' }, 503)
    const familyId = c.req.param('familyId') ?? ''
    const { provider, model, apiKey } = c.req.valid('json')
    const saved = await readFamilyAi(c.env.DB, familyId)
    let sealed: { keyCipher: string; keyHint: string }
    if (apiKey !== null)
      sealed = { keyCipher: await encryptKey(secret, apiKey), keyHint: keyHint(apiKey) }
    else if (saved && saved.provider === provider) sealed = saved
    else return c.json({ error: 'invalid_key' }, 400)
    await c.env.DB.prepare(
      `insert into family_ai (family_id, provider, model, key_cipher, key_hint, updated_by, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict (family_id) do update set provider = excluded.provider, model = excluded.model,
         key_cipher = excluded.key_cipher, key_hint = excluded.key_hint,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
      .bind(
        familyId,
        provider,
        model,
        sealed.keyCipher,
        sealed.keyHint,
        c.get('user').id,
        Date.now(),
      )
      .run()
    return c.json({ provider, model, keyHint: sealed.keyHint })
  })
  .delete('/', async (c) => {
    await c.env.DB.prepare('delete from family_ai where family_id = ?')
      .bind(c.req.param('familyId') ?? '')
      .run()
    return c.body(null, 204)
  })

import { type FamilySummary, createFamilyRequestSchema, newId } from '@bobo/shared'
import { Hono } from 'hono'

import type { AppEnv } from '../types'

export const familyRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      `select f.id, f.name, m.role from memberships m join families f on f.id = m.family_id
       where m.user_id = ? order by f.created_at`,
    )
      .bind(c.get('user').id)
      .all<FamilySummary>()
    return c.json(results)
  })
  .post('/', async (c) => {
    const parsed = createFamilyRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const userId = c.get('user').id
    const now = Date.now()
    const family: FamilySummary = { id: newId(now), name: parsed.data.name, role: 'owner' }
    await c.env.DB.batch([
      c.env.DB.prepare(
        'insert into families (id, name, created_by, created_at, updated_at) values (?, ?, ?, ?, ?)',
      ).bind(family.id, family.name, userId, now, now),
      c.env.DB.prepare(
        "insert into memberships (family_id, user_id, role, created_at) values (?, ?, 'owner', ?)",
      ).bind(family.id, userId, now),
    ])
    return c.json(family, 201)
  })

import {
  type FamilyMember,
  type FamilyRole,
  type FamilySummary,
  MANAGE_ROLES,
  createFamilyRequestSchema,
  newId,
  renameFamilyRequestSchema,
  transferOwnershipRequestSchema,
  updateMemberRequestSchema,
} from '@bobo/shared'
import { Hono } from 'hono'

import { loadAccess, toSummaries } from '../access'
import { canManageMember } from '../members'
import type { AppEnv } from '../types'

export const familyRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(toSummaries(await loadAccess(c.env.DB, c.get('user').id))))
  .post('/', async (c) => {
    const parsed = createFamilyRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const userId = c.get('user').id
    const now = Date.now()
    const family: FamilySummary = {
      id: newId(now),
      name: parsed.data.name,
      role: 'owner',
      babyIds: null,
    }
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
  .patch('/:familyId', async (c) => {
    const role = await roleOf(c.env.DB, c.req.param('familyId'), c.get('user').id)
    if (!role || !MANAGE_ROLES.includes(role)) return c.json({ error: 'forbidden' }, 403)
    const parsed = renameFamilyRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    await c.env.DB.prepare('update families set name = ?, updated_at = ? where id = ?')
      .bind(parsed.data.name, Date.now(), c.req.param('familyId'))
      .run()
    return c.body(null, 204)
  })
  .get('/:familyId/members', async (c) => {
    const familyId = c.req.param('familyId')
    if (!(await roleOf(c.env.DB, familyId, c.get('user').id))) {
      return c.json({ error: 'forbidden' }, 403)
    }
    const { results } = await c.env.DB.prepare(
      `select m.user_id as userId, u.name, u.image, m.role, m.baby_scope as babyScope,
         (select json_group_array(mb.baby_id) from membership_babies mb
          where mb.family_id = m.family_id and mb.user_id = m.user_id) as babyIds
       from memberships m join user u on u.id = m.user_id
       where m.family_id = ? order by m.created_at`,
    )
      .bind(familyId)
      .all<Omit<FamilyMember, 'babyIds'> & { babyScope: 'all' | 'selected'; babyIds: string }>()
    const members: FamilyMember[] = results.map((row) => ({
      userId: row.userId,
      name: row.name,
      image: row.image,
      role: row.role,
      babyIds: row.babyScope === 'all' ? null : parseIds(row.babyIds),
    }))
    return c.json(members)
  })
  .patch('/:familyId/members/:userId', async (c) => {
    const db = c.env.DB
    const familyId = c.req.param('familyId')
    const targetId = c.req.param('userId')
    const parsed = updateMemberRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const [actor, target] = await Promise.all([
      roleOf(db, familyId, c.get('user').id),
      roleOf(db, familyId, targetId),
    ])
    if (!actor || !target || !canManageMember(actor, target, parsed.data.role)) {
      return c.json({ error: 'forbidden' }, 403)
    }

    const { role, babyIds } = parsed.data
    if (babyIds) {
      // Only babies of this family can be granted.
      const valid = await db
        .prepare(
          'select count(*) as n from babies where family_id = ? and id in (select value from json_each(?))',
        )
        .bind(familyId, JSON.stringify(babyIds))
        .first<{ n: number }>()
      if (valid?.n !== new Set(babyIds).size) return c.json({ error: 'invalid' }, 400)
    }

    const statements: D1PreparedStatement[] = []
    if (role) {
      statements.push(
        db
          .prepare('update memberships set role = ? where family_id = ? and user_id = ?')
          .bind(role, familyId, targetId),
      )
    }
    if (babyIds !== undefined) {
      statements.push(
        db
          .prepare('update memberships set baby_scope = ? where family_id = ? and user_id = ?')
          .bind(babyIds === null ? 'all' : 'selected', familyId, targetId),
        db
          .prepare('delete from membership_babies where family_id = ? and user_id = ?')
          .bind(familyId, targetId),
      )
      if (babyIds?.length) {
        statements.push(
          db
            .prepare(
              `insert into membership_babies (family_id, user_id, baby_id)
             select ?, ?, value from json_each(?)`,
            )
            .bind(familyId, targetId, JSON.stringify([...new Set(babyIds)])),
        )
      }
    }
    await db.batch(statements)
    return c.body(null, 204)
  })
  .delete('/:familyId/members/:userId', async (c) => {
    const db = c.env.DB
    const familyId = c.req.param('familyId')
    const userId = c.get('user').id
    const targetId = c.req.param('userId')
    const [actor, target] = await Promise.all([
      roleOf(db, familyId, userId),
      roleOf(db, familyId, targetId),
    ])
    const leaving = targetId === userId && target !== null && target !== 'owner'
    if (!actor || !target || !(leaving || canManageMember(actor, target))) {
      return c.json({ error: 'forbidden' }, 403)
    }
    await db.batch([
      db
        .prepare('delete from membership_babies where family_id = ? and user_id = ?')
        .bind(familyId, targetId),
      db
        .prepare('delete from memberships where family_id = ? and user_id = ?')
        .bind(familyId, targetId),
    ])
    return c.body(null, 204)
  })
  .post('/:familyId/transfer', async (c) => {
    const db = c.env.DB
    const familyId = c.req.param('familyId')
    const userId = c.get('user').id
    const parsed = transferOwnershipRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const [actor, target] = await Promise.all([
      roleOf(db, familyId, userId),
      roleOf(db, familyId, parsed.data.userId),
    ])
    if (actor !== 'owner' || !target || parsed.data.userId === userId) {
      return c.json({ error: 'forbidden' }, 403)
    }
    // The new owner sees every baby; the previous owner stays on as an admin.
    await db.batch([
      db
        .prepare(
          "update memberships set role = 'owner', baby_scope = 'all' where family_id = ? and user_id = ?",
        )
        .bind(familyId, parsed.data.userId),
      db
        .prepare('delete from membership_babies where family_id = ? and user_id = ?')
        .bind(familyId, parsed.data.userId),
      db
        .prepare("update memberships set role = 'admin' where family_id = ? and user_id = ?")
        .bind(familyId, userId),
    ])
    return c.body(null, 204)
  })

async function roleOf(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<FamilyRole | null> {
  const row = await db
    .prepare('select role from memberships where family_id = ? and user_id = ?')
    .bind(familyId, userId)
    .first<{ role: FamilyRole }>()
  return row?.role ?? null
}

function parseIds(json: string): string[] {
  const value: unknown = JSON.parse(json)
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

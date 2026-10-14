import { type Reminder, pushSubscriptionSchema, reminderSchema } from '@bobo/shared'
import { Hono } from 'hono'

import { getVapidKeys, notifyUser } from '../reminders'
import type { AppEnv } from '../types'

/** Whether the user can see the baby: a member of its family, within their baby scope. */
async function canSeeBaby(db: D1Database, userId: string, babyId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `select 1 from babies b join memberships m on m.family_id = b.family_id and m.user_id = ?1
       where b.id = ?2 and b.deleted_at is null and (m.baby_scope = 'all' or exists (
         select 1 from membership_babies mb
         where mb.family_id = m.family_id and mb.user_id = m.user_id and mb.baby_id = b.id))`,
    )
    .bind(userId, babyId)
    .first()
  return row !== null
}

/** Push subscriptions of the signed-in user's devices. */
export const pushRoutes = new Hono<AppEnv>()
  .get('/key', async (c) => c.json({ publicKey: (await getVapidKeys(c.env.DB)).publicKey }))
  .put('/subscription', async (c) => {
    const parsed = pushSubscriptionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const { endpoint, keys } = parsed.data
    // A browser belongs to whoever signed in on it last.
    await c.env.DB.prepare(
      `insert into push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
       values (?, ?, ?, ?, ?)
       on conflict (endpoint) do update set
         user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
      .bind(endpoint, c.get('user').id, keys.p256dh, keys.auth, Date.now())
      .run()
    return c.body(null, 204)
  })
  .delete('/subscription', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const endpoint =
      typeof body === 'object' && body !== null && 'endpoint' in body ? body.endpoint : undefined
    if (typeof endpoint !== 'string') return c.json({ error: 'invalid' }, 400)
    await c.env.DB.prepare('delete from push_subscriptions where endpoint = ? and user_id = ?')
      .bind(endpoint, c.get('user').id)
      .run()
    return c.body(null, 204)
  })
  .post('/test', async (c) => {
    const results = await notifyUser(
      c.env,
      c.get('user').id,
      { title: 'Bobo', body: '通知已开启，提醒会这样出现。', tag: 'test', url: '/settings' },
      Date.now(),
    )
    return c.json({ sent: results.filter((result) => result === 'sent').length })
  })

/** The signed-in user's reminders; each user picks their own. */
export const reminderRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      `select baby_id as babyId, kind, interval_minutes as intervalMinutes, enabled
       from reminders where user_id = ?`,
    )
      .bind(c.get('user').id)
      .all<Omit<Reminder, 'enabled'> & { enabled: number }>()
    const reminders: Reminder[] = results.map((row) => ({
      babyId: row.babyId,
      kind: row.kind,
      intervalMinutes: row.intervalMinutes,
      enabled: row.enabled === 1,
    }))
    return c.json(reminders)
  })
  .put('/', async (c) => {
    const parsed = reminderSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const { babyId, kind, intervalMinutes, enabled } = parsed.data
    const userId = c.get('user').id
    if (!(await canSeeBaby(c.env.DB, userId, babyId))) return c.json({ error: 'forbidden' }, 403)
    const now = Date.now()
    // A gap that is already longer than the interval doesn't notify right away; the next one does.
    await c.env.DB.prepare(
      `insert into reminders (user_id, baby_id, kind, interval_minutes, enabled, fired_for, updated_at)
       values (?1, ?2, ?3, ?4, ?5, (
         select case when max(e.start_at) + ?4 * 60000 <= ?6 then max(e.start_at) end
         from events e where e.baby_id = ?2 and e.type = ?3 and e.deleted_at is null), ?6)
       on conflict (user_id, baby_id, kind) do update set
         interval_minutes = excluded.interval_minutes, enabled = excluded.enabled,
         fired_for = max(coalesce(reminders.fired_for, 0), coalesce(excluded.fired_for, 0)),
         updated_at = excluded.updated_at`,
    )
      .bind(userId, babyId, kind, intervalMinutes, enabled ? 1 : 0, now)
      .run()
    return c.json(parsed.data)
  })

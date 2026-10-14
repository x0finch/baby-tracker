import { MINUTE, type PushMessage, type ReminderKind } from '@bobo/shared'

import type { Env } from './env'
import {
  type PushResult,
  type PushTarget,
  type VapidKeys,
  generateVapidKeys,
  sendPush,
} from './web-push'

/** Reminders not sent within this long after they were due are skipped (e.g. after an outage). */
const LATE_LIMIT = 3 * 60 * MINUTE
/** Bounded so one cron run stays well within the free plan's CPU limit. */
const BATCH = 20

const VAPID_KEY_NAME = 'vapid'

/** The VAPID key pair, created and stored on first use so deploys need no extra secret. */
export async function getVapidKeys(db: D1Database): Promise<VapidKeys> {
  const read = () =>
    db
      .prepare('select value from server_keys where name = ?')
      .bind(VAPID_KEY_NAME)
      .first<{ value: string }>()
  let row = await read()
  if (!row) {
    const keys = await generateVapidKeys()
    // Concurrent first uses race here; whichever insert lands first wins and both read it.
    await db
      .prepare('insert or ignore into server_keys (name, value, created_at) values (?, ?, ?)')
      .bind(VAPID_KEY_NAME, JSON.stringify(keys), Date.now())
      .run()
    row = await read()
  }
  if (!row) throw new Error('VAPID keys unavailable')
  const keys: VapidKeys = JSON.parse(row.value)
  return keys
}

/** VAPID subject: a contact URL for push services. */
export const vapidSubject = (env: Pick<Env, 'BETTER_AUTH_URL'>) => env.BETTER_AUTH_URL

export interface DueReminder {
  userId: string
  babyId: string
  kind: ReminderKind
  intervalMinutes: number
  babyName: string
  lastAt: number
}

// Latest start of an event of the reminder's kind for the baby.
const LATEST = `(select max(e.start_at) from events e
  where e.baby_id = r.baby_id and e.type = r.kind and e.deleted_at is null)`

/**
 * Reminders whose interval has passed since the latest event of their kind, not yet sent for
 * that event, for babies the user can still see.
 */
export async function dueReminders(db: D1Database, now: number): Promise<DueReminder[]> {
  const { results } = await db
    .prepare(
      `select * from (
         select r.user_id as userId, r.baby_id as babyId, r.kind, r.interval_minutes as intervalMinutes,
           r.fired_for as firedFor, b.name as babyName, ${LATEST} as lastAt
         from reminders r
         join babies b on b.id = r.baby_id and b.deleted_at is null and b.archived_at is null
         join memberships m on m.family_id = b.family_id and m.user_id = r.user_id
         where r.enabled = 1 and (m.baby_scope = 'all' or exists (
           select 1 from membership_babies mb
           where mb.family_id = m.family_id and mb.user_id = m.user_id and mb.baby_id = r.baby_id))
       )
       where lastAt is not null
         and lastAt + intervalMinutes * 60000 <= ?1
         and lastAt + intervalMinutes * 60000 > ?1 - ?2
         and (firedFor is null or firedFor < lastAt)
       limit ?3`,
    )
    .bind(now, LATE_LIMIT, BATCH)
    .all<DueReminder>()
  return results
}

/** "3 小时 5 分钟" */
function elapsedLabel(ms: number): string {
  const minutes = Math.floor(ms / MINUTE)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} 分钟`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

// The app ships in Chinese only so far; notifications match it.
const TITLES: Record<ReminderKind, string> = { feeding: '该喂奶啦', diaper: '该看看尿布啦' }
const SINCE: Record<ReminderKind, string> = { feeding: '距上次喂养', diaper: '距上次换尿布' }

export function reminderMessage(reminder: DueReminder, now: number): PushMessage {
  return {
    title: TITLES[reminder.kind],
    body: `${reminder.babyName} ${SINCE[reminder.kind]}已经 ${elapsedLabel(now - reminder.lastAt)}`,
    tag: `reminder-${reminder.babyId}-${reminder.kind}`,
    url: '/',
  }
}

type SubscriptionRow = PushTarget & { userId: string }

async function subscriptionsOf(db: D1Database, userIds: string[]): Promise<SubscriptionRow[]> {
  if (userIds.length === 0) return []
  const { results } = await db
    .prepare(
      `select endpoint, p256dh, auth, user_id as userId from push_subscriptions
       where user_id in (select value from json_each(?))`,
    )
    .bind(JSON.stringify(userIds))
    .all<SubscriptionRow>()
  return results
}

/** Sends a message to every device of a user; expired subscriptions are removed. */
export async function notifyUser(
  env: Pick<Env, 'DB' | 'BETTER_AUTH_URL'>,
  userId: string,
  message: PushMessage,
  now: number,
  fetcher?: typeof fetch,
): Promise<PushResult[]> {
  const targets = await subscriptionsOf(env.DB, [userId])
  if (targets.length === 0) return []
  const keys = await getVapidKeys(env.DB)
  const results = await Promise.all(
    targets.map((target) => sendPush(target, message, keys, vapidSubject(env), now, fetcher)),
  )
  await removeGone(env.DB, targets, results)
  return results
}

async function removeGone(db: D1Database, targets: PushTarget[], results: PushResult[]) {
  const gone = targets.filter((_, i) => results[i] === 'gone').map((target) => target.endpoint)
  if (gone.length === 0) return
  await db
    .prepare('delete from push_subscriptions where endpoint in (select value from json_each(?))')
    .bind(JSON.stringify(gone))
    .run()
}

/** Cron entry point: sends due reminders and marks them sent. */
export async function dispatchReminders(
  env: Pick<Env, 'DB' | 'BETTER_AUTH_URL'>,
  now: number,
  fetcher?: typeof fetch,
): Promise<number> {
  const db = env.DB
  const due = await dueReminders(db, now)
  if (due.length === 0) return 0

  const targets = await subscriptionsOf(db, [...new Set(due.map((reminder) => reminder.userId))])
  const keys = targets.length > 0 ? await getVapidKeys(db) : undefined
  const sends: Promise<PushResult>[] = []
  const sentTo: PushTarget[] = []
  for (const reminder of due) {
    const message = reminderMessage(reminder, now)
    for (const target of targets) {
      if (target.userId !== reminder.userId || !keys) continue
      sentTo.push(target)
      sends.push(sendPush(target, message, keys, vapidSubject(env), now, fetcher))
    }
  }
  const results = await Promise.all(sends)

  // Marked even without a device to send to, so each gap is considered once.
  await db.batch(
    due.map((reminder) =>
      db
        .prepare(
          'update reminders set fired_for = ? where user_id = ? and baby_id = ? and kind = ?',
        )
        .bind(reminder.lastAt, reminder.userId, reminder.babyId, reminder.kind),
    ),
  )
  await removeGone(db, sentTo, results)
  return results.filter((result) => result === 'sent').length
}

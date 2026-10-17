import { base64UrlEncode, newId } from '@bobo/shared'

const DAY_MS = 86_400_000
/** A code nobody has used for this long stops working; every use pushes the date back. */
export const TOKEN_IDLE_MS = 180 * DAY_MS
/** Requests a code may make per UTC day: a leaked code can't run up the AI bill. */
export const DAILY_LIMIT = 200
const PREFIX = 'bobo_'

/**
 * A password changed or reset since the code was made ends it: the code acts for the account
 * without a session, so it must not outlive the old password.
 */
const PASSWORD_UNCHANGED = `not exists (select 1 from account a where a.user_id = voice_tokens.user_id
  and a.provider_id = 'credential' and a.updated_at > voice_tokens.created_at)`

export interface VoiceToken {
  id: string
  userId: string
  familyId: string
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Creates the user's code for a family, replacing an earlier one. Only the hash is stored. */
export async function createToken(db: D1Database, userId: string, familyId: string, now: number) {
  const token = PREFIX + base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const id = newId(now)
  await db.batch([
    db
      .prepare('delete from voice_tokens where user_id = ? and family_id = ?')
      .bind(userId, familyId),
    db
      .prepare(
        `insert into voice_tokens (id, user_id, family_id, token_hash, created_at, expires_at)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, familyId, await sha256Hex(token), now, now + TOKEN_IDLE_MS),
  ])
  return { id, token }
}

/** Revokes one of the user's codes: by family, or by id (only if it is still that code). */
export function revokeToken(
  db: D1Database,
  userId: string,
  by: { familyId: string } | { id: string },
) {
  return 'id' in by
    ? db.prepare('delete from voice_tokens where user_id = ? and id = ?').bind(userId, by.id)
    : db
        .prepare('delete from voice_tokens where user_id = ? and family_id = ?')
        .bind(userId, by.familyId)
}

/** The user's working codes, by family. */
export async function tokenStatuses(db: D1Database, userId: string, now: number) {
  const { results } = await db
    .prepare(
      `select family_id as familyId, created_at as createdAt, last_used_at as lastUsedAt
       from voice_tokens where user_id = ? and expires_at > ? and ${PASSWORD_UNCHANGED}`,
    )
    .bind(userId, now)
    .all<{ familyId: string; createdAt: number; lastUsedAt: number | null }>()
  return new Map(results.map(({ familyId, ...status }) => [familyId, status]))
}

export type TokenCheck =
  | { status: 'ok'; token: VoiceToken }
  | { status: 'invalid' }
  | { status: 'limited' }

/**
 * Checks a code from a shortcut's Authorization header and counts the request: extends the
 * code's life and enforces the daily cap, in one statement.
 */
export async function useToken(
  db: D1Database,
  header: string | undefined,
  now: number,
): Promise<TokenCheck> {
  // The shortcut may send the code with or without the Bearer scheme.
  const raw = header?.trim().match(/^(?:Bearer\s+)?(\S+)$/i)?.[1]
  if (!raw?.startsWith(PREFIX)) return { status: 'invalid' }
  const day = new Date(now).toISOString().slice(0, 10)
  const row = await db
    .prepare(
      `update voice_tokens set
         last_used_at = ?1, expires_at = ?1 + ?2,
         day_count = case when day = ?3 then day_count + 1 else 1 end, day = ?3
       where token_hash = ?4 and expires_at > ?1
         and ${PASSWORD_UNCHANGED}
       returning id, user_id as userId, family_id as familyId, day_count as dayCount`,
    )
    .bind(now, TOKEN_IDLE_MS, day, await sha256Hex(raw))
    .first<VoiceToken & { dayCount: number }>()
  if (!row) return { status: 'invalid' }
  if (row.dayCount > DAILY_LIMIT) return { status: 'limited' }
  return { status: 'ok', token: { id: row.id, userId: row.userId, familyId: row.familyId } }
}

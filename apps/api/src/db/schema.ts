import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Server copies of the shared records (@bobo/shared). Timestamps are epoch milliseconds.
const syncColumns = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  createdBy: text('created_by'),
  /**
   * Server-assigned sync sequence (from sync_seq) of the last accepted write. Pull cursors use
   * it instead of timestamps, which are not monotonic across Worker instances.
   */
  seq: integer('seq').notNull().default(0),
}

export const babies = sqliteTable(
  'babies',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id'),
    name: text('name').notNull(),
    birthDate: text('birth_date').notNull(),
    sex: text('sex', { enum: ['female', 'male', 'unspecified'] }).notNull(),
    avatarColor: text('avatar_color').notNull(),
    archivedAt: integer('archived_at'),
    ...syncColumns,
  },
  (table) => [index('babies_family_seq_idx').on(table.familyId, table.seq, table.id)],
)

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id').notNull(),
    familyId: text('family_id'),
    type: text('type', {
      enum: [
        'feeding',
        'sleep',
        'diaper',
        'pumping',
        'temperature',
        'medication',
        'note',
        'growth',
      ],
    }).notNull(),
    startAt: integer('start_at').notNull(),
    endAt: integer('end_at'),
    // Type-specific payload, validated with the shared zod schema before writing.
    data: text('data', { mode: 'json' }).notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (table) => [
    index('events_baby_start_idx').on(table.babyId, table.startAt),
    index('events_family_seq_idx').on(table.familyId, table.seq, table.id),
  ],
)

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const memberships = sqliteTable(
  'memberships',
  {
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'caregiver', 'viewer'] }).notNull(),
    /** 'all' babies of the family, or only those listed in membership_babies. */
    babyScope: text('baby_scope', { enum: ['all', 'selected'] })
      .notNull()
      .default('all'),
    /** The member's private name for the family, shown only to them. */
    alias: text('alias'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.familyId, table.userId] }),
    index('memberships_user_idx').on(table.userId),
  ],
)

export const membershipBabies = sqliteTable(
  'membership_babies',
  {
    familyId: text('family_id').notNull(),
    userId: text('user_id').notNull(),
    babyId: text('baby_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.familyId, table.userId, table.babyId] })],
)

/** Single-use invite links; the code is the secret, so it is long and random. */
export const invites = sqliteTable(
  'invites',
  {
    code: text('code').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'caregiver', 'viewer'] }).notNull(),
    /** JSON array of baby ids, or null for every baby. */
    babyIds: text('baby_ids'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedBy: text('used_by'),
    usedAt: integer('used_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [index('invites_family_idx').on(table.familyId)],
)

/** Single-row counter; every accepted push increments it inside the same D1 transaction. */
export const syncSeq = sqliteTable('sync_seq', {
  id: integer('id').primaryKey(),
  value: integer('value').notNull(),
})

/** Web Push subscriptions; one per browser, owned by the user signed in when it subscribed. */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('push_subscriptions_user_idx').on(table.userId)],
)

/**
 * "It's been a while" reminders a user set for a baby: notify when the latest event of the
 * kind started more than interval_minutes ago. Independent of how notifications are delivered.
 */
export const reminders = sqliteTable(
  'reminders',
  {
    userId: text('user_id').notNull(),
    babyId: text('baby_id').notNull(),
    kind: text('kind', { enum: ['feeding', 'diaper'] }).notNull(),
    intervalMinutes: integer('interval_minutes').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    /** start_at of the event the last reminder was sent for, so each gap notifies once. */
    firedFor: integer('fired_for'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.babyId, table.kind] }),
    index('reminders_enabled_idx').on(table.enabled),
  ],
)

/** Keys the server creates for itself on first use, such as the VAPID key pair. */
export const serverKeys = sqliteTable('server_keys', {
  name: text('name').primaryKey(),
  value: text('value').notNull(),
  createdAt: integer('created_at').notNull(),
})

/**
 * A family's AI model for voice logging, set by its owner or admins. The provider key is
 * encrypted with AI_KEY_SECRET (AES-GCM); only its last characters are kept in clear.
 */
export const familyAi = sqliteTable('family_ai', {
  familyId: text('family_id')
    .primaryKey()
    .references(() => families.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['openai', 'openrouter'] }).notNull(),
  model: text('model').notNull(),
  /** base64url of iv (12 bytes) followed by the ciphertext. */
  keyCipher: text('key_cipher').notNull(),
  keyHint: text('key_hint').notNull(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/** A user's Siri voice logging settings: what they say to Siri and their time zone. */
export const voiceSettings = sqliteTable('voice_settings', {
  userId: text('user_id').primaryKey(),
  phrase: text('phrase').notNull(),
  /** The one family Siri records for, with its AI; null picks the user's only family. */
  familyId: text('family_id'),
  /** IANA zone for times said aloud ("三点"), from the browser that set it up. */
  timeZone: text('time_zone').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * The code a Siri shortcut sends instead of a session: one per user, stored as a SHA-256
 * hash. It only adds records and undoes the last ones, and lapses after long disuse.
 */
export const voiceTokens = sqliteTable(
  'voice_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    expiresAt: integer('expires_at').notNull(),
    /** Requests on `day` (UTC date), for the daily cap. */
    day: text('day').notNull().default(''),
    dayCount: integer('day_count').notNull().default(0),
  },
  (table) => [
    uniqueIndex('voice_tokens_hash_idx').on(table.tokenHash),
    index('voice_tokens_user_idx').on(table.userId),
  ],
)

/** What the last voice command changed, so "撤销" can put it back. One per user. */
export const voiceUndo = sqliteTable('voice_undo', {
  userId: text('user_id').primaryKey(),
  /** JSON: [{ id, before }] where before is the event as it was, or null if it was added. */
  changes: text('changes').notNull(),
  createdAt: integer('created_at').notNull(),
})

export * from './auth-schema'

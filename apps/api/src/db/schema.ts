import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export * from './auth-schema'

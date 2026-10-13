import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Server copies of the shared records (@bobo/shared). Timestamps are epoch milliseconds.
const syncColumns = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  createdBy: text('created_by'),
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
  (table) => [index('babies_family_idx').on(table.familyId)],
)

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id').notNull(),
    familyId: text('family_id'),
    type: text('type', { enum: ['feeding', 'sleep', 'diaper'] }).notNull(),
    startAt: integer('start_at').notNull(),
    endAt: integer('end_at'),
    // Type-specific payload, validated with the shared zod schema before writing.
    data: text('data', { mode: 'json' }).notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (table) => [
    index('events_baby_start_idx').on(table.babyId, table.startAt),
    index('events_family_idx').on(table.familyId),
  ],
)

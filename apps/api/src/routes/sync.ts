import {
  type Baby,
  type Event,
  type PullResponse,
  type PushResponse,
  SYNC_PULL_LIMIT,
  SYNC_PUSH_LIMIT,
  pushRequestSchema,
} from '@bobo/shared'
import { Hono } from 'hono'

import { checkBabyWrite, checkEventWrite, loadAccess, readScope, toSummaries } from '../access'
import {
  type ExistingRow,
  type SyncCursor,
  type TableCursor,
  decodeCursor,
  encodeCursor,
  parseBaby,
  parseEvent,
  planWrites,
} from '../sync'
import {
  bumpSeq,
  selectBabiesPage,
  selectEventsPage,
  selectExisting,
  upsertBabies,
  upsertEvents,
} from '../sync-sql'
import type { AppEnv } from '../types'

type BabyRow = Baby & { seq: number }
type EventRow = Omit<Event, 'data'> & { data: string; seq: number }

const toMap = (rows: ExistingRow[]) => new Map(rows.map((row) => [row.id, row]))

function lastOf(rows: readonly { seq: number; id: string }[], fallback: TableCursor): TableCursor {
  const last = rows.at(-1)
  return last ? [last.seq, last.id] : fallback
}

function toBaby({ seq: _seq, ...baby }: BabyRow): Baby {
  return baby
}

function toEvent({ seq: _seq, data, ...event }: EventRow): Event {
  // Rows are validated against the event schema when written; re-validating every pulled
  // row would spend the CPU budget (10ms on the free plan) for no gain.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.assign(event, { data: JSON.parse(data) as unknown }) as Event
}

function idsOf(items: unknown[]): string[] {
  return items.flatMap((item) =>
    typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
      ? [item.id]
      : [],
  )
}

export const syncRoutes = new Hono<AppEnv>()
  .post('/push', async (c) => {
    const parsed = pushRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid' }, 400)
    const { babies, events } = parsed.data
    if (babies.length + events.length > SYNC_PUSH_LIMIT) return c.json({ error: 'too_large' }, 413)

    const db = c.env.DB
    const userId = c.get('user').id
    const access = await loadAccess(db, userId)

    const [existingBabies, existingEvents] = await db.batch<ExistingRow>([
      selectExisting(db, 'babies', idsOf(babies)),
      selectExisting(db, 'events', idsOf(events)),
    ])
    const babyPlan = planWrites<Baby>(
      babies,
      parseBaby,
      toMap(existingBabies?.results ?? []),
      (baby, current) => checkBabyWrite(access, baby, current),
      userId,
    )
    const eventPlan = planWrites<Event>(
      events,
      parseEvent,
      toMap(existingEvents?.results ?? []),
      (event, current) =>
        checkEventWrite(
          access,
          event,
          current && { ...current, babyId: current.babyId ?? event.babyId },
          userId,
        ),
      userId,
    )

    if (babyPlan.writes.length + eventPlan.writes.length > 0) {
      // One transaction: the sequence bump and the upserts commit together, so a pull never
      // sees rows whose seq is ahead of a concurrent push.
      await db.batch([
        bumpSeq(db),
        ...(babyPlan.writes.length > 0 ? [upsertBabies(db, babyPlan.writes)] : []),
        ...(eventPlan.writes.length > 0 ? [upsertEvents(db, eventPlan.writes)] : []),
      ])
    }

    const response: PushResponse = { babies: babyPlan.results, events: eventPlan.results }
    return c.json(response)
  })
  .get('/pull', async (c) => {
    const db = c.env.DB
    const cursor = decodeCursor(c.req.query('cursor'))
    const access = await loadAccess(db, c.get('user').id)
    const scope = readScope(access)
    if (scope.familyIds.length === 0 && scope.babyIds.length === 0) {
      const empty: PullResponse = {
        babies: [],
        events: [],
        access: [],
        cursor: encodeCursor(cursor),
        hasMore: false,
      }
      return c.json(empty)
    }

    const [babyRows, eventRows] = await Promise.all([
      selectBabiesPage(db, scope, cursor.babies, SYNC_PULL_LIMIT + 1).all<BabyRow>(),
      selectEventsPage(db, scope, cursor.events, SYNC_PULL_LIMIT + 1).all<EventRow>(),
    ])
    const babyPage = babyRows.results.slice(0, SYNC_PULL_LIMIT)
    const eventPage = eventRows.results.slice(0, SYNC_PULL_LIMIT)
    const hasMore =
      babyRows.results.length > SYNC_PULL_LIMIT || eventRows.results.length > SYNC_PULL_LIMIT

    const next: SyncCursor = {
      babies: lastOf(babyPage, cursor.babies),
      events: lastOf(eventPage, cursor.events),
    }

    const response: PullResponse = {
      babies: babyPage.map(toBaby),
      events: eventPage.map(toEvent),
      access: toSummaries(access),
      cursor: encodeCursor(next),
      hasMore,
    }
    return c.json(response)
  })

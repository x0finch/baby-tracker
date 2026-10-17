import type { ModelMessage, RunRecord, RunStatus } from '@tanstack/ai'
import {
  type ChatWithInterruptsPersistence,
  type InterruptRecord,
  type InterruptStatus,
  defineAIPersistence,
} from '@tanstack/ai-persistence'

// TanStack AI chat state in D1, after its Cloudflare recipe: messages, runs and interrupts
// (tool approvals). Rows are JSON in text columns; times are epoch ms.

function parse<T>(json: string | null): T | undefined {
  // Values come from this module's own writes.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return json === null ? undefined : (JSON.parse(json) as T)
}

interface RunRow {
  run_id: string
  thread_id: string
  status: RunStatus
  started_at: number
  finished_at: number | null
  error: string | null
  error_code: string | null
  usage_json: string | null
  sandbox_key: string | null
  detached_since: number | null
  cancel_requested: number | null
  driver_epoch: number | null
  parent_run_id: string | null
  subagent_run_id: string | null
  name: string | null
}

function toRun(row: RunRow): RunRecord {
  const usage = parse<RunRecord['usage']>(row.usage_json)
  return {
    runId: row.run_id,
    threadId: row.thread_id,
    status: row.status,
    startedAt: row.started_at,
    ...(row.finished_at !== null ? { finishedAt: row.finished_at } : {}),
    ...(row.error !== null
      ? {
          error: {
            message: row.error,
            ...(row.error_code !== null ? { code: row.error_code } : {}),
          },
        }
      : {}),
    ...(usage ? { usage } : {}),
    ...(row.sandbox_key !== null ? { sandboxKey: row.sandbox_key } : {}),
    ...(row.detached_since !== null ? { detachedSince: row.detached_since } : {}),
    ...(row.cancel_requested !== null ? { cancelRequested: row.cancel_requested === 1 } : {}),
    ...(row.driver_epoch !== null ? { driverEpoch: row.driver_epoch } : {}),
    ...(row.parent_run_id !== null ? { parentRunId: row.parent_run_id } : {}),
    ...(row.subagent_run_id !== null ? { subagentRunId: row.subagent_run_id } : {}),
    ...(row.name !== null ? { name: row.name } : {}),
  }
}

interface InterruptRow {
  interrupt_id: string
  run_id: string
  thread_id: string
  status: InterruptStatus
  requested_at: number
  resolved_at: number | null
  payload_json: string
  response_json: string | null
}

function toInterrupt(row: InterruptRow): InterruptRecord {
  const response = parse<unknown>(row.response_json)
  return {
    interruptId: row.interrupt_id,
    runId: row.run_id,
    threadId: row.thread_id,
    status: row.status,
    requestedAt: row.requested_at,
    ...(row.resolved_at !== null ? { resolvedAt: row.resolved_at } : {}),
    payload: parse<Record<string, unknown>>(row.payload_json) ?? {},
    ...(response !== undefined ? { response } : {}),
  }
}

/** Builds the stores on the request's D1 binding. */
export function chatPersistence(db: D1Database): ChatWithInterruptsPersistence {
  const runs = (sql: string, ...binds: unknown[]) =>
    db
      .prepare(sql)
      .bind(...binds)
      .all<RunRow>()
      .then(({ results }) => results.map(toRun))
  const interrupts = (sql: string, ...binds: unknown[]) =>
    db
      .prepare(sql)
      .bind(...binds)
      .all<InterruptRow>()
      .then(({ results }) => results.map(toInterrupt))
  const getRun = async (runId: string) => {
    const row = await db
      .prepare('select * from chat_runs where run_id = ?')
      .bind(runId)
      .first<RunRow>()
    return row ? toRun(row) : null
  }

  return defineAIPersistence({
    stores: {
      messages: {
        loadThread: async (threadId: string) => {
          const row = await db
            .prepare('select messages_json from chat_threads where thread_id = ?')
            .bind(threadId)
            .first<{ messages_json: string }>()
          return parse<ModelMessage[]>(row?.messages_json ?? null) ?? []
        },
        saveThread: async (threadId, messages) => {
          await db
            .prepare(
              `insert into chat_threads (thread_id, messages_json, updated_at) values (?, ?, ?)
               on conflict (thread_id) do update set
                 messages_json = excluded.messages_json, updated_at = excluded.updated_at`,
            )
            .bind(threadId, JSON.stringify(messages), Date.now())
            .run()
        },
      },
      runs: {
        createOrResume: async (input) => {
          const existing = await getRun(input.runId)
          if (existing) return existing
          await db
            .prepare(
              `insert into chat_runs (run_id, thread_id, status, started_at, parent_run_id,
                 subagent_run_id, name)
               values (?, ?, ?, ?, ?, ?, ?) on conflict (run_id) do nothing`,
            )
            .bind(
              input.runId,
              input.threadId,
              input.status ?? 'running',
              input.startedAt,
              input.parentRunId ?? null,
              input.subagentRunId ?? null,
              input.name ?? null,
            )
            .run()
          const created = await getRun(input.runId)
          if (!created) throw new Error(`Run ${input.runId} was not stored`)
          return created
        },
        update: async (runId, patch) => {
          const sets: string[] = []
          const binds: unknown[] = []
          const set = (column: string, value: unknown) => {
            sets.push(`${column} = ?`)
            binds.push(value ?? null)
          }
          if ('status' in patch) set('status', patch.status)
          if ('finishedAt' in patch) set('finished_at', patch.finishedAt)
          if ('error' in patch) {
            set('error', patch.error?.message)
            set('error_code', patch.error?.code)
          }
          if ('usage' in patch) set('usage_json', patch.usage ? JSON.stringify(patch.usage) : null)
          if ('sandboxKey' in patch) set('sandbox_key', patch.sandboxKey)
          if ('detachedSince' in patch) set('detached_since', patch.detachedSince)
          if ('cancelRequested' in patch) {
            set(
              'cancel_requested',
              patch.cancelRequested === undefined ? null : Number(patch.cancelRequested),
            )
          }
          if ('driverEpoch' in patch) set('driver_epoch', patch.driverEpoch)
          if (sets.length === 0) return
          await db
            .prepare(`update chat_runs set ${sets.join(', ')} where run_id = ?`)
            .bind(...binds, runId)
            .run()
        },
        get: getRun,
        findActiveRun: async (threadId) =>
          (
            await runs(
              `select * from chat_runs where thread_id = ? and status = 'running'
               order by started_at desc limit 1`,
              threadId,
            )
          )[0] ?? null,
        listByThread: (threadId) =>
          runs('select * from chat_runs where thread_id = ? order by started_at', threadId),
      },
      interrupts: {
        create: async (record) => {
          await db
            .prepare(
              `insert into chat_interrupts (interrupt_id, run_id, thread_id, status, requested_at,
                 payload_json)
               values (?, ?, ?, 'pending', ?, ?) on conflict (interrupt_id) do nothing`,
            )
            .bind(
              record.interruptId,
              record.runId,
              record.threadId,
              record.requestedAt,
              JSON.stringify(record.payload),
            )
            .run()
        },
        resolve: async (interruptId, response) => {
          await db
            .prepare(
              `update chat_interrupts set status = 'resolved', resolved_at = ?, response_json = ?
               where interrupt_id = ?`,
            )
            .bind(Date.now(), response === undefined ? null : JSON.stringify(response), interruptId)
            .run()
        },
        cancel: async (interruptId) => {
          await db
            .prepare(
              `update chat_interrupts set status = 'cancelled', resolved_at = ? where interrupt_id = ?`,
            )
            .bind(Date.now(), interruptId)
            .run()
        },
        get: async (interruptId) => {
          const row = await db
            .prepare('select * from chat_interrupts where interrupt_id = ?')
            .bind(interruptId)
            .first<InterruptRow>()
          return row ? toInterrupt(row) : null
        },
        list: (threadId) =>
          interrupts(
            'select * from chat_interrupts where thread_id = ? order by requested_at',
            threadId,
          ),
        listPending: (threadId) =>
          interrupts(
            `select * from chat_interrupts where thread_id = ? and status = 'pending'
             order by requested_at`,
            threadId,
          ),
        listByRun: (runId) =>
          interrupts('select * from chat_interrupts where run_id = ? order by requested_at', runId),
        listPendingByRun: (runId) =>
          interrupts(
            `select * from chat_interrupts where run_id = ? and status = 'pending'
             order by requested_at`,
            runId,
          ),
      },
    },
  })
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deleteOldConversations } from '../src/agent/retention'
import { createTestEnv } from './d1'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 18, 12)

describe('voice conversation retention', () => {
  let env: Awaited<ReturnType<typeof createTestEnv>>['env']
  let dispose: () => Promise<void>
  const ids = async (table: string, column: string) =>
    (
      await env.DB.prepare(`select ${column} as id from ${table} order by 1`).all<{ id: string }>()
    ).results.map((row) => row.id)

  beforeAll(async () => {
    ;({ env, dispose } = await createTestEnv())
    const add = (thread: string, at: number) => [
      env.DB.prepare(
        'insert into chat_threads (thread_id, messages_json, updated_at) values (?, ?, ?)',
      ).bind(thread, '[]', at),
      env.DB.prepare(
        'insert into chat_runs (run_id, thread_id, status, started_at) values (?, ?, ?, ?)',
      ).bind(`run_${thread}`, thread, 'finished', at),
      env.DB.prepare(
        `insert into chat_interrupts (interrupt_id, run_id, thread_id, status, requested_at,
           payload_json) values (?, ?, ?, ?, ?, ?)`,
      ).bind(`int_${thread}`, `run_${thread}`, thread, 'pending', at, '{}'),
      env.DB.prepare(
        `insert into voice_ops (id, thread_id, run_id, event_id, created_at)
         values (?, ?, ?, ?, ?)`,
      ).bind(`op_${thread}`, thread, `run_${thread}`, 'event', at),
    ]
    await env.DB.batch([...add('old', NOW - 31 * DAY), ...add('recent', NOW - 29 * DAY)])
  })
  afterAll(() => dispose())

  it('deletes conversations last used over 30 days ago, with all their records', async () => {
    await deleteOldConversations(env.DB, NOW)
    expect(await ids('chat_threads', 'thread_id')).toEqual(['recent'])
    expect(await ids('chat_runs', 'thread_id')).toEqual(['recent'])
    expect(await ids('chat_interrupts', 'thread_id')).toEqual(['recent'])
    expect(await ids('voice_ops', 'thread_id')).toEqual(['recent'])
  })
})

import { readFile, readdir } from 'node:fs/promises'

import { Miniflare } from 'miniflare'

import type { Env } from '../src/env'

const migrationsDir = new URL('../migrations/', import.meta.url)

/** A fresh in-memory D1 database with all migrations applied, as the Worker would see it. */
export async function createTestEnv(): Promise<{ env: Env; dispose: () => Promise<void> }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null, { status: 404 }) } }',
    d1Databases: { DB: crypto.randomUUID() },
  })
  const db = await mf.getD1Database('DB')

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).toSorted()
  // Migrations must run in order, one after another.
  /* oxlint-disable no-await-in-loop */
  for (const file of files) {
    const sql = await readFile(new URL(file, migrationsDir), 'utf8')
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)
    await db.batch(statements.map((statement) => db.prepare(statement)))
  }
  /* oxlint-enable no-await-in-loop */

  return { env: { DB: db }, dispose: () => mf.dispose() }
}

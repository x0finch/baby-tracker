import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { createTestEnv } from './d1'

describe('api', () => {
  const app = createApp()
  let env: Env
  let dispose: () => Promise<void>

  beforeAll(async () => {
    ;({ env, dispose } = await createTestEnv())
  })
  afterAll(() => dispose())

  it('reports health including the D1 binding', async () => {
    const res = await app.request('/api/health', {}, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('applies the migrations', async () => {
    const tables = await env.DB.prepare(
      "select name from sqlite_master where type = 'table' and name in ('babies', 'events') order by name",
    ).all<{ name: string }>()
    expect(tables.results.map((row) => row.name)).toEqual(['babies', 'events'])
  })

  it('returns JSON 404s for unknown API routes', async () => {
    const res = await app.request('/api/nope', {}, env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

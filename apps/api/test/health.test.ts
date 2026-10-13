import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApp } from './app'

describe('api', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(() => t.dispose())

  it('reports health including the D1 binding', async () => {
    const res = await t.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('applies the migrations', async () => {
    const tables = await t.env.DB.prepare(
      "select name from sqlite_master where type = 'table' and name in ('babies', 'events', 'user', 'session') order by name",
    ).all<{ name: string }>()
    expect(tables.results.map((row) => row.name)).toEqual(['babies', 'events', 'session', 'user'])
  })

  it('returns JSON 404s for unknown API routes', async () => {
    const res = await t.request('/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

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

  it('returns JSON 404s for unknown API routes, once signed in', async () => {
    // Without a session nothing past the public routes answers, unknown ones included.
    expect((await t.request('/api/nope')).status).toBe(401)
    const { headers } = await t.signIn()
    const res = await t.request('/api/nope', { headers })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('answers 401 without a session on every route but the public ones', async () => {
    const open = new Set(['/api/health', '/api/auth/*', '/api/invites/:code', '/api/voice/siri'])
    const routes = t.app.routes.filter((route) => route.method !== 'ALL' && !open.has(route.path))
    expect(routes.length).toBeGreaterThan(30)
    for (const route of routes) {
      const path = route.path.replaceAll(/:\w+/g, '01J00000000000000000000000')
      const res = await t.send(route.method, path)
      expect(`${route.method} ${route.path} ${res.status}`).toBe(
        `${route.method} ${route.path} 401`,
      )
    }
  })
})

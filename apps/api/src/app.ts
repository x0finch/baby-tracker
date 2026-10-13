import { Hono } from 'hono'

import type { Env } from './env'

export function createApp() {
  const app = new Hono<{ Bindings: Env }>().basePath('/api')

  app.get('/health', async (c) => {
    // Touch D1 so the check covers the binding, not just the Worker.
    await c.env.DB.prepare('select 1').first()
    return c.json({ ok: true })
  })

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}

export type App = ReturnType<typeof createApp>

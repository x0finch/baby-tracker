import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'

import { type Auth, getAuth, trustedOrigins } from './auth'
import type { Env } from './env'

type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>

export type AppEnv = {
  Bindings: Env
  Variables: { user: SessionData['user']; session: SessionData['session'] }
}

/** The parts of a Better Auth instance the app uses; tests inject one with extra plugins. */
export interface AuthLike {
  handler: Auth['handler']
  api: { getSession: Auth['api']['getSession'] }
}

export interface AppOptions {
  auth?: (env: Env) => AuthLike
}

export function createApp(options: AppOptions = {}) {
  const authFor = options.auth ?? getAuth
  const app = new Hono<AppEnv>().basePath('/api')

  // The web app is same-origin; CORS only matters for the native shell (#45).
  app.use(
    '*',
    cors({
      origin: (origin, c) => (trustedOrigins(c.env).includes(origin) ? origin : null),
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['set-auth-token'],
    }),
  )

  app.get('/health', async (c) => {
    // Touch D1 so the check covers the binding, not just the Worker.
    await c.env.DB.prepare('select 1').first()
    return c.json({ ok: true })
  })

  app.on(['GET', 'POST'], '/auth/*', (c) => authFor(c.env).handler(c.req.raw))

  /** Resolves the session from the cookie (or bearer token); most requests hit the cookie cache. */
  const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    const { headers, response: data } = await authFor(c.env).api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
    })
    if (!data) return c.json({ error: 'unauthorized' }, 401)
    c.set('user', data.user)
    c.set('session', data.session)
    await next()
    // Forward cookie updates (cache refresh, session renewal) so later requests skip D1.
    for (const cookie of headers.getSetCookie()) c.res.headers.append('Set-Cookie', cookie)
    return undefined
  })

  app.get('/me', requireUser, (c) => {
    const user = c.get('user')
    return c.json({ id: user.id, name: user.name, email: user.email, image: user.image ?? null })
  })

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}

export type App = ReturnType<typeof createApp>

import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { getAuth, trustedOrigins } from './auth'
import { requireUser } from './middleware'
import { accountRoutes } from './routes/account'
import { familyRoutes } from './routes/families'
import { familyInviteRoutes, inviteAcceptRoutes, invitePreviewRoutes } from './routes/invites'
import { syncRoutes } from './routes/sync'
import type { AppEnv, AuthFor } from './types'

export type { AppEnv, AuthLike } from './types'

export interface AppOptions {
  auth?: AuthFor
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

  const auth = requireUser(authFor)

  app.get('/me', auth, (c) => {
    const user = c.get('user')
    return c.json({ id: user.id, name: user.name, email: user.email, image: user.image ?? null })
  })

  app.use('/account', auth)
  app.route('/account', accountRoutes)
  app.use('/families', auth)
  app.use('/families/*', auth)
  app.route('/families/:familyId/invites', familyInviteRoutes)
  app.route('/families', familyRoutes)
  app.route('/invites', invitePreviewRoutes)
  app.use('/invites/:code/accept', auth)
  app.route('/invites', inviteAcceptRoutes)
  app.use('/sync/*', auth)
  app.route('/sync', syncRoutes)

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}

export type App = ReturnType<typeof createApp>

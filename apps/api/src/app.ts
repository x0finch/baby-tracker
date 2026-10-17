import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { getAuth, trustedOrigins } from './auth'
import { errorResponse } from './http'
import { requireUser } from './middleware'
import { authRateLimit } from './rate-limit'
import { accountRoutes } from './routes/account'
import { familyAiRoutes, userAiRoutes } from './routes/ai'
import { familyRoutes } from './routes/families'
import { familyInviteRoutes, inviteAcceptRoutes, invitePreviewRoutes } from './routes/invites'
import { pushRoutes, reminderRoutes } from './routes/notifications'
import { syncRoutes } from './routes/sync'
import { type AdapterFor, siriRoutes, voiceRoutes } from './routes/voice'
import type { AppEnv, AuthFor } from './types'
import { decryptKey, aiAdapter } from './voice/ai'

export interface AppOptions {
  auth?: AuthFor
  /** The model behind voice logging; tests pass a fake instead of calling a provider. */
  voiceAdapter?: AdapterFor
}

/** A saved provider, model and key, as a model adapter. */
const defaultAdapter: AdapterFor = async (env, ai) => {
  if (!env.AI_KEY_SECRET) return null
  return aiAdapter(ai.provider, ai.model, await decryptKey(env.AI_KEY_SECRET, ai.keyCipher))
}

export function createApp(options: AppOptions = {}) {
  const authFor = options.auth ?? getAuth
  const voiceAdapter = options.voiceAdapter ?? defaultAdapter
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

  app.use('/auth/*', authRateLimit)
  app.on(['GET', 'POST'], '/auth/*', (c) => authFor(c.env).handler(c.req.raw))

  const auth = requireUser(authFor)

  app.get('/me', auth, (c) => {
    const user = c.get('user')
    return c.json({ id: user.id, name: user.name, email: user.email, image: user.image ?? null })
  })

  app.use('/ai', auth)
  app.use('/ai/*', auth)
  app.route('/ai', userAiRoutes)
  app.use('/account', auth)
  app.route('/account', accountRoutes)
  app.use('/families', auth)
  app.use('/families/*', auth)
  app.route('/families/:familyId/invites', familyInviteRoutes)
  app.route('/families/:familyId/ai', familyAiRoutes)
  app.route('/families', familyRoutes)
  app.route('/invites', invitePreviewRoutes)
  app.use('/invites/:code/accept', auth)
  app.route('/invites', inviteAcceptRoutes)
  app.use('/sync/*', auth)
  app.route('/sync', syncRoutes)
  app.use('/push/*', auth)
  app.route('/push', pushRoutes)
  app.use('/reminders', auth)
  app.route('/reminders', reminderRoutes)
  // The shortcut authenticates with its own code, not a session.
  app.route('/voice/siri', siriRoutes(voiceAdapter))
  app.use('/voice', auth)
  app.use('/voice/token', auth)
  app.use('/voice/tokens/*', auth)
  app.use('/voice/chat', auth)
  app.route('/voice', voiceRoutes(voiceAdapter))

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError(errorResponse)

  return app
}

export type App = ReturnType<typeof createApp>

import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { getAuth, trustedOrigins } from './auth'
import { errorResponse } from './http'
import { requireUser } from './middleware'
import { authRateLimit } from './rate-limit'
import { accountRoutes } from './routes/account'
import { familyRoutes } from './routes/families'
import { familyAiRoutes, readFamilyAi } from './routes/family-ai'
import { familyInviteRoutes, inviteAcceptRoutes, invitePreviewRoutes } from './routes/invites'
import { pushRoutes, reminderRoutes } from './routes/notifications'
import { syncRoutes } from './routes/sync'
import { type VoiceParserFor, siriRoutes, voiceRoutes } from './routes/voice'
import type { AppEnv, AuthFor } from './types'
import { decryptKey, familyParser } from './voice/ai'

export interface AppOptions {
  auth?: AuthFor
  /** Parses Siri voice commands; tests pass a fake instead of calling the model. */
  voiceParser?: VoiceParserFor
}

/** Parses with the family's own provider, model and key. */
const defaultVoiceParser: VoiceParserFor = async (env, familyId) => {
  const saved = await readFamilyAi(env.DB, familyId)
  if (!saved || !env.AI_KEY_SECRET) return null
  return familyParser(
    saved.provider,
    saved.model,
    await decryptKey(env.AI_KEY_SECRET, saved.keyCipher),
  )
}

export function createApp(options: AppOptions = {}) {
  const authFor = options.auth ?? getAuth
  const voiceParser = options.voiceParser ?? defaultVoiceParser
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
  app.route('/voice/siri', siriRoutes(voiceParser))
  app.use('/voice', auth)
  app.use('/voice/token', auth)
  app.use('/voice/preview', auth)
  app.route('/voice', voiceRoutes(voiceParser))

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError(errorResponse)

  return app
}

export type App = ReturnType<typeof createApp>

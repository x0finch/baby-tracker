import { newId } from '@bobo/shared'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { bearer } from 'better-auth/plugins/bearer'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from './db/schema'
import type { Env } from './env'

/** The app origin plus the future Capacitor shell (#45), which calls the API cross-origin. */
export function trustedOrigins(env: Env): string[] {
  return [env.BETTER_AUTH_URL, 'capacitor://localhost', 'https://localhost']
}

/**
 * Better Auth configured for the Workers free plan (10ms CPU per request):
 * - `better-auth/minimal` (no Kysely) and only the bearer plugin, to keep the bundle small
 * - signed cookie cache (compact HMAC, not JWE) so most requests validate the session
 *   without a D1 read, and a long `updateAge` so sessions are rarely rewritten
 * - no email/password (avoids scrypt) and no DB-backed rate limiting (Cloudflare handles it)
 */
export function createAuthOptions(env: Env) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined

  return {
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    socialProviders: google ? { google } : {},
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60, strategy: 'compact' as const },
    },
    user: {
      additionalFields: { locale: { type: 'string' as const, required: false } },
    },
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    trustedOrigins: trustedOrigins(env),
    advanced: { database: { generateId: () => newId() } },
    plugins: [bearer()],
  }
}

export function createAuth(env: Env) {
  return betterAuth(createAuthOptions(env))
}

export type Auth = ReturnType<typeof createAuth>

// One instance per isolate: building the instance is pure CPU, and the env object is
// stable for the lifetime of the isolate.
const instances = new WeakMap<Env, Auth>()

export function getAuth(env: Env): Auth {
  let auth = instances.get(env)
  if (!auth) {
    auth = createAuth(env)
    instances.set(env, auth)
  }
  return auth
}

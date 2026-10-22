import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from './types'

/** Sends an email: limited per address so nobody can flood an inbox. */
const SENDS_EMAIL = new Set([
  '/api/auth/email-otp/request-password-reset',
  '/api/auth/email-otp/send-verification-otp',
  '/api/auth/forget-password/email-otp',
])
/** Checks a secret: limited per account so passwords and codes cannot be guessed quickly. */
const GUESSES = new Set([
  '/api/auth/sign-in/email',
  '/api/auth/email-otp/reset-password',
  '/api/auth/sign-in/email-otp',
])
/** Limited per IP only: no address in the request. */
const PER_IP = new Set([
  '/api/auth/sign-up/email',
  '/api/auth/passkey/verify-authentication',
  // Checks the current password, though only for someone already signed in.
  '/api/auth/change-password',
])

async function emailOf(request: Request): Promise<string | undefined> {
  try {
    // Read a copy: Better Auth still needs the original body.
    const body: unknown = await request.clone().json()
    return typeof body === 'object' &&
      body !== null &&
      'email' in body &&
      typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : undefined
  } catch {
    return undefined
  }
}

const allowed = { success: true }

/**
 * Rate limits for the auth endpoints, using Workers rate limiters (counted in memory at the
 * edge, no D1 queries):
 * - per IP, every sign-in, sign-up and reset request
 * - per address, emails sent (AUTH_EMAIL_RATE_LIMIT) and password or code checks
 *   (AUTH_IP_RATE_LIMIT's budget under an account key)
 * Without the bindings (tests, local dev without them) nothing is limited.
 */
export const authRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path
  const sends = SENDS_EMAIL.has(path)
  const guesses = GUESSES.has(path)
  if (c.req.method !== 'POST' || !(sends || guesses || PER_IP.has(path))) return next()

  const { AUTH_EMAIL_RATE_LIMIT: byEmail, AUTH_IP_RATE_LIMIT: byIp } = c.env
  const ip = c.req.header('cf-connecting-ip')
  const email = (sends && byEmail) || (guesses && byIp) ? await emailOf(c.req.raw) : undefined
  const checks = await Promise.all([
    byIp && ip ? byIp.limit({ key: `ip:${ip}` }) : allowed,
    sends && byEmail && email ? byEmail.limit({ key: email }) : allowed,
    guesses && byIp && email ? byIp.limit({ key: `account:${email}` }) : allowed,
  ])
  if (checks.some((check) => !check.success)) {
    return c.json({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' }, 429)
  }
  return next()
}

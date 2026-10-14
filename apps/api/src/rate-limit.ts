import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from './types'

const SEND_PATH = '/api/auth/email-otp/send-verification-otp'
const VERIFY_PATH = '/api/auth/sign-in/email-otp'

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

/**
 * Limits sending codes per email address (stops mail bombing one inbox), and sending and
 * checking codes per IP (stops one client spraying addresses or guessing). Guesses per code
 * are also capped by the plugin's allowedAttempts. Workers rate limiters count in memory at
 * the edge, so this costs no D1 queries. Without the bindings (tests, dev) nothing is limited.
 */
export const otpRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sending = c.req.path === SEND_PATH
  if (c.req.method !== 'POST' || !(sending || c.req.path === VERIFY_PATH)) return next()
  const { AUTH_EMAIL_RATE_LIMIT: byEmail, AUTH_IP_RATE_LIMIT: byIp } = c.env
  const ip = c.req.header('cf-connecting-ip')
  const email = byEmail && sending ? await emailOf(c.req.raw) : undefined
  const checks = await Promise.all([
    byIp && ip ? byIp.limit({ key: ip }) : { success: true },
    byEmail && email ? byEmail.limit({ key: email }) : { success: true },
  ])
  if (checks.some((check) => !check.success)) {
    return c.json({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' }, 429)
  }
  return next()
}

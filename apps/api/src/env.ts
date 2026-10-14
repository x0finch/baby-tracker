import type { EmailBinding } from './email'

export interface Env {
  DB: D1Database
  /** Public origin of the app, e.g. https://bobo.example.workers.dev */
  BETTER_AUTH_URL: string
  /** Secret used to sign session cookies (wrangler secret put BETTER_AUTH_SECRET). */
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** Cloudflare Email Service binding (Workers Paid plan); preferred when present. */
  EMAIL?: EmailBinding
  /** Resend API key, used to send email on the free plan (wrangler secret put RESEND_API_KEY). */
  RESEND_API_KEY?: string
  /** Sender address, e.g. "Bobo <noreply@yourdomain.com>"; its domain must be verified. */
  EMAIL_FROM?: string
  /** Workers rate limiters for sign-in codes, per email address and per IP (wrangler.jsonc). */
  AUTH_EMAIL_RATE_LIMIT?: RateLimit
  AUTH_IP_RATE_LIMIT?: RateLimit
}

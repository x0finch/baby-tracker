export interface Env {
  DB: D1Database
  /** Public origin of the app, e.g. https://bobo.example.workers.dev */
  BETTER_AUTH_URL: string
  /** Secret used to sign session cookies (wrangler secret put BETTER_AUTH_SECRET). */
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

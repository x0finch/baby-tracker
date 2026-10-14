import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { trustedOrigins } from '../src/auth'
import type { Env } from '../src/env'
import { createTestApp } from './app'

function preflightInit(origin: string): RequestInit {
  return { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } }
}

describe('auth', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(() => t.dispose())

  it('rejects protected routes without a session', async () => {
    const res = await t.request('/api/me')
    expect(res.status).toBe(401)
  })

  it('returns the signed-in user', async () => {
    const { user, headers } = await t.signIn()
    const res = await t.request('/api/me', { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: user.id, name: '测试家长' })
  })

  it('validates repeat requests from the signed cookie cache without querying D1', async () => {
    // signIn() keeps the cache cookie set by the first authenticated response.
    const { headers } = await t.signIn()
    expect(headers.get('cookie')).toContain('session_data')
    const before = t.queries.count
    const res = await t.request('/api/me', { headers })
    expect(res.status).toBe(200)
    expect(t.queries.count - before).toBe(0)
  })

  it('starts Google sign-in and stores the OAuth state in D1', async () => {
    const res = await t.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
    })
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toHaveProperty('url')
    const url = typeof body === 'object' && body !== null && 'url' in body ? String(body.url) : ''
    expect(new URL(url).hostname).toBe('accounts.google.com')
    const state = await t.env.DB.prepare('select count(*) as n from verification').first<{
      n: number
    }>()
    expect(state?.n).toBeGreaterThan(0)
  })

  it('refuses sign-up with a raw (not app-derived) password', async () => {
    const res = await t.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
      body: JSON.stringify({ email: 'a@example.com', password: 'password1234', name: 'a' }),
    })
    expect(res.ok).toBe(false)
  })

  it('allows CORS only for trusted origins', async () => {
    expect(
      (await t.request('/api/me', preflightInit('capacitor://localhost'))).headers.get(
        'access-control-allow-origin',
      ),
    ).toBe('capacitor://localhost')
    expect(
      (await t.request('/api/me', preflightInit('https://evil.example'))).headers.get(
        'access-control-allow-origin',
      ),
    ).toBeNull()
  })
})

describe('extra trusted origins', () => {
  // The app answers on a custom domain and on its workers.dev address.
  const extra = ' https://bobo.example.workers.dev/ , '

  it('trusts every origin serving the app, normalised', () => {
    const env = { BETTER_AUTH_URL: 'https://bobo.example.com', TRUSTED_ORIGINS: extra } as Env
    expect(trustedOrigins(env)).toEqual([
      'https://bobo.example.com',
      'https://bobo.example.workers.dev',
      'capacitor://localhost',
      'https://localhost',
    ])
  })

  it('allows CORS from the extra origins', async () => {
    const t = await createTestApp({ TRUSTED_ORIGINS: extra })
    try {
      const res = await t.request('/api/me', preflightInit('https://bobo.example.workers.dev'))
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://bobo.example.workers.dev',
      )
    } finally {
      await t.dispose()
    }
  })
})

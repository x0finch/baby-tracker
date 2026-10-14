import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { type OutgoingEmail, sendEmail } from '../src/email'
import type { Env } from '../src/env'
import { TEST_ORIGIN, createTestApp } from './app'

const sent: OutgoingEmail[] = []
const codeFor = (email: string) => {
  const message = sent.findLast((item) => item.to === email)
  return /(\d{6})/.exec(message?.text ?? '')?.[1] ?? ''
}

/** Allows `limit` calls per key, like the Workers binding within one period. */
function fakeRateLimit(limit: number): RateLimit {
  const counts = new Map<string, number>()
  return {
    limit: async ({ key }) => {
      const next = (counts.get(key) ?? 0) + 1
      counts.set(key, next)
      return { success: next <= limit }
    },
  }
}

describe('email sign-in codes', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    t.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_ORIGIN, ...headers },
      body: JSON.stringify(body),
    })
  const sendCode = (email: string, ip = '203.0.113.1') =>
    post(
      '/api/auth/email-otp/send-verification-otp',
      { email, type: 'sign-in' },
      { 'cf-connecting-ip': ip },
    )
  const signIn = (email: string, otp: string) => post('/api/auth/sign-in/email-otp', { email, otp })

  beforeAll(async () => {
    t = await createTestApp({
      EMAIL: {
        send: async (message) => {
          sent.push(message)
          return { messageId: 'test' }
        },
      },
      AUTH_EMAIL_RATE_LIMIT: fakeRateLimit(3),
      AUTH_IP_RATE_LIMIT: fakeRateLimit(20),
    })
  })
  afterAll(() => t.dispose())

  it('emails a code that signs the user in and creates the account once', async () => {
    expect((await sendCode('mama@example.com')).status).toBe(200)
    const message = sent.at(-1)
    expect(message?.subject).toMatch(/^Bobo 登录验证码：\d{6}$/)
    expect(message?.text).toContain('10 分钟内有效')

    const res = await signIn('mama@example.com', codeFor('mama@example.com'))
    expect(res.status).toBe(200)
    const cookie = res.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
    const me = await t.request('/api/me', { headers: { cookie } })
    const user: { id: string; name: string; email: string } = await me.json()
    expect(user).toMatchObject({ name: 'mama', email: 'mama@example.com' })

    await sendCode('mama@example.com')
    const again = await signIn('mama@example.com', codeFor('mama@example.com'))
    const second: { user: { id: string } } = await again.json()
    expect(second.user.id).toBe(user.id)
  })

  it('rejects wrong and reused codes', async () => {
    await sendCode('papa@example.com')
    const code = codeFor('papa@example.com')
    const wrong = code === '000000' ? '111111' : '000000'
    expect((await signIn('papa@example.com', wrong)).status).toBe(400)
    expect((await signIn('papa@example.com', code)).status).toBe(200)
    expect((await signIn('papa@example.com', code)).status).toBe(400)
  })

  it('limits how often codes are sent to one address', async () => {
    for (let i = 0; i < 3; i += 1) {
      // Each request must still reach Better Auth with its body intact.
      expect((await sendCode('spam@example.com', `198.51.100.${i}`)).status).toBe(200)
    }
    const limited = await sendCode('spam@example.com', '198.51.100.9')
    expect(limited.status).toBe(429)
  })
})

describe('sendEmail', () => {
  const email: OutgoingEmail = { to: 'a@example.com', subject: 's', text: 't', html: '<p>t</p>' }

  it('uses Resend when no Email Service binding exists', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    try {
      await sendEmail(
        { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Bobo <hi@bobo.test>' } as Env,
        email,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      )
      const body = fetchMock.mock.calls[0]?.[1].body
      expect(JSON.parse(typeof body === 'string' ? body : '')).toMatchObject({
        from: 'Bobo <hi@bobo.test>',
        to: ['a@example.com'],
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('fails loudly when Resend refuses the message', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 422 }))
    try {
      await expect(sendEmail({ RESEND_API_KEY: 're_test' } as Env, email)).rejects.toThrow('422')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { PasswordRefused, checkNewPassword, isBreached } from './password-check'

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex').toUpperCase()

/** A breach API that knows `breached`, padded like the real one; records what it was asked. */
function breachApi(breached: string[]) {
  const asked: string[] = []
  const request: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    const prefix = url.slice(-5)
    asked.push(prefix)
    const lines = breached
      .map(sha1)
      .filter((hash) => hash.startsWith(prefix))
      .map((hash) => `${hash.slice(5)}:42`)
    lines.push(`${'0'.repeat(35)}:0`)
    return new Response(lines.join('\r\n'))
  }
  return { request, asked }
}

const refusal = (email: string, password: string, request?: typeof fetch) =>
  checkNewPassword(email, password, request ?? breachApi([]).request).then(
    () => null,
    (error: unknown) => (error instanceof PasswordRefused ? error.message : 'other'),
  )

describe('new passwords', () => {
  it('sends only the first five hex digits of the hash', async () => {
    const api = breachApi(['correct horse'])
    expect(await isBreached('correct horse', api.request)).toBe(true)
    expect(api.asked).toEqual([sha1('correct horse').slice(0, 5)])
    expect(await isBreached('a much rarer phrase', api.request)).toBe(false)
  })

  it('refuses breached passwords, and allows them when the check fails', async () => {
    expect(
      await refusal('a@example.com', 'password123', breachApi(['password123']).request),
    ).toMatch(/泄露/)
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await refusal('a@example.com', 'password123', offline)).toBeNull()
    const down = (async () => new Response('', { status: 503 })) as typeof fetch
    expect(await refusal('a@example.com', 'password123', down)).toBeNull()
  })

  it('refuses short and obvious passwords without asking', async () => {
    expect(await refusal('a@example.com', 'abc')).toMatch(/至少 8 位/)
    expect(await refusal('a@example.com', '20240101')).toMatch(/容易猜/)
    expect(await refusal('a@example.com', 'aaaaaaaaaa')).toMatch(/容易猜/)
    expect(await refusal('Mama.Wang@example.com', 'mama.wang2024')).toMatch(/容易猜/)
    expect(await refusal('mama@example.com', 'MAMA@example.com')).toMatch(/容易猜/)
    expect(await refusal('mama@example.com', 'tea-kettle-sunrise')).toBeNull()
  })
})

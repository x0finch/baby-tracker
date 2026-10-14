import { pbkdf2Sync } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { derivePasswordKey } from './password'

describe('derivePasswordKey', () => {
  it('matches PBKDF2-HMAC-SHA256 salted with the normalised email', async () => {
    const expected = pbkdf2Sync(
      '秘密 password',
      'bobo-password:mama@example.com',
      1000,
      32,
      'sha256',
    )
    const derived = await derivePasswordKey(' Mama@Example.com ', '秘密 password', 1000)
    expect(derived).toBe(expected.toString('hex'))
    expect(derived).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs per email so equal passwords never share a key', async () => {
    const a = await derivePasswordKey('a@example.com', 'same-password', 1000)
    const b = await derivePasswordKey('b@example.com', 'same-password', 1000)
    expect(a).not.toBe(b)
  })
})

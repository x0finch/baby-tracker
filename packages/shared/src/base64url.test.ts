import { describe, expect, it } from 'vitest'

import { base64UrlDecode, base64UrlEncode } from './base64url'

describe('base64url', () => {
  it('encodes without padding using the URL alphabet', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_')
    expect(base64UrlEncode(new Uint8Array([1]))).toBe('AQ')
  })

  it('round-trips bytes', () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 37) % 256)
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes)
  })
})

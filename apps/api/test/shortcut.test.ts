import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestApp } from './app'

const SIGNED = new Uint8Array([0x41, 0x45, 0x41, 0x31, 1, 2, 3])

describe('signed shortcut file', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(() => t.dispose())
  afterEach(() => vi.unstubAllGlobals())

  it('serves the file iCloud signed, with a fresh link from the record', async () => {
    const fetched: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetched.push(url)
        if (url.includes('/shortcuts/api/records/')) {
          return Response.json({
            fields: {
              signedShortcut: {
                value: { downloadURL: 'https://cvws.icloud-content.com/B/abc/${f}?o=1' },
              },
            },
          })
        }
        return new Response(SIGNED)
      }),
    )
    // No session needed: Shortcuts downloads it.
    const res = await t.request('/api/voice/shortcut.shortcut')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(SIGNED)
    expect(fetched[1]).toBe(
      `https://cvws.icloud-content.com/B/abc/${encodeURIComponent('记录宝宝.shortcut')}?o=1`,
    )
  })

  it('answers 502 when iCloud has no signed file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    )
    expect((await t.request('/api/voice/shortcut.shortcut')).status).toBe(502)
  })
})

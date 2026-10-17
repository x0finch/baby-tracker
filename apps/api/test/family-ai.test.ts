import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { decryptKey } from '../src/voice/ai'
import { createTestApp } from './app'

const SECRET = 'test-ai-key-secret-test-ai-key-secret'
const KEY = 'sk-or-v1-abcdefghijklmnop1234'

/** OpenRouter as the server sees it: a key check, then the model list. */
function fakeOpenRouter(valid = true) {
  return vi.fn<(input: string) => Promise<Response>>(async (url) => {
    if (url.endsWith('/key')) return new Response('{}', { status: valid ? 200 : 401 })
    return Response.json({
      data: [
        { id: 'zeta/model', supported_parameters: ['tools'] },
        { id: 'openai/gpt-5.4-mini', supported_parameters: ['tools'] },
        { id: 'old/model', supported_parameters: ['structured_outputs'] },
      ],
    })
  })
}

describe('family AI settings', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let owner: Headers
  let familyId: string
  const path = () => `/api/families/${familyId}/ai`

  beforeAll(async () => {
    t = await createTestApp({ AI_KEY_SECRET: SECRET })
    owner = (await t.signIn()).headers
    const res = await t.send('POST', '/api/families', owner, { name: '我们家' })
    const family: { id: string } = await res.json()
    familyId = family.id
  })
  afterAll(() => t.dispose())
  afterEach(() => vi.unstubAllGlobals())

  it('starts empty', async () => {
    expect(await (await t.request(path(), { headers: owner })).json()).toBeNull()
  })

  it('checks a key and lists usable models, recommended first', async () => {
    vi.stubGlobal('fetch', fakeOpenRouter())
    const res = await t.send('POST', `${path()}/models`, owner, {
      provider: 'openrouter',
      apiKey: KEY,
    })
    expect(await res.json()).toEqual({
      models: [
        { id: 'openai/gpt-5.4-mini', recommended: true },
        { id: 'zeta/model', recommended: false },
      ],
    })
  })

  it('rejects a bad key', async () => {
    vi.stubGlobal('fetch', fakeOpenRouter(false))
    const res = await t.send('POST', `${path()}/models`, owner, {
      provider: 'openrouter',
      apiKey: KEY,
    })
    expect(res.status).toBe(400)
  })

  it('stores the key encrypted and only shows its end', async () => {
    const res = await t.send('PUT', path(), owner, {
      provider: 'openrouter',
      model: 'openai/gpt-5.4-mini',
      apiKey: KEY,
    })
    expect(await res.json()).toEqual({
      provider: 'openrouter',
      model: 'openai/gpt-5.4-mini',
      keyHint: 'sk-or-…1234',
    })
    const row = await t.env.DB.prepare('select key_cipher as c from family_ai').first<{
      c: string
    }>()
    expect(row?.c).not.toContain(KEY)
    expect(await decryptKey(SECRET, row?.c ?? '')).toBe(KEY)
    // Changing only the model keeps the saved key.
    await t.send('PUT', path(), owner, {
      provider: 'openrouter',
      model: 'zeta/model',
      apiKey: null,
    })
    expect(
      await decryptKey(
        SECRET,
        (await t.env.DB.prepare('select key_cipher as c from family_ai').first<{ c: string }>())
          ?.c ?? '',
      ),
    ).toBe(KEY)
  })

  it('is for owners and admins only', async () => {
    const caregiver = await t.signIn('阿姨')
    const invite = await t.send('POST', `/api/families/${familyId}/invites`, owner, {
      role: 'caregiver',
      babyIds: null,
    })
    const { code } = (await invite.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, caregiver.headers)
    expect((await t.request(path(), { headers: caregiver.headers })).status).toBe(403)
    expect(
      (
        await t.send('PUT', path(), caregiver.headers, {
          provider: 'openai',
          model: 'x',
          apiKey: KEY,
        })
      ).status,
    ).toBe(403)
  })

  it('can be removed', async () => {
    await t.send('DELETE', path(), owner)
    expect(await (await t.request(path(), { headers: owner })).json()).toBeNull()
  })
})

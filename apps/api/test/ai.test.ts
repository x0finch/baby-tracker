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

describe('AI settings', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let owner: Headers
  let familyId: string
  const save = (headers: Headers, model = 'openai/gpt-5.4-mini', apiKey: string | null = KEY) =>
    t.send('PUT', '/api/ai', headers, { provider: 'openrouter', model, apiKey })
  const cipher = async () =>
    (await t.env.DB.prepare('select key_cipher as c from user_ai').first<{ c: string }>())?.c ?? ''
  const family = async (headers = owner): Promise<unknown> =>
    (await t.request(`/api/families/${familyId}/ai`, { headers })).json()

  beforeAll(async () => {
    t = await createTestApp({ ENCRYPTION_SECRET: SECRET })
    owner = (await t.signIn()).headers
    const res = await t.send('POST', '/api/families', owner, { name: '我们家' })
    const created: { id: string } = await res.json()
    familyId = created.id
  })
  afterAll(() => t.dispose())
  afterEach(() => vi.unstubAllGlobals())

  it('starts empty', async () => {
    expect(await (await t.request('/api/ai', { headers: owner })).json()).toBeNull()
    expect(await family()).toEqual({ inUse: null, shares: [] })
  })

  it('checks a key and lists models that can use tools, recommended first', async () => {
    vi.stubGlobal('fetch', fakeOpenRouter())
    const res = await t.send('POST', '/api/ai/models', owner, {
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
    const res = await t.send('POST', '/api/ai/models', owner, {
      provider: 'openrouter',
      apiKey: KEY,
    })
    expect(res.status).toBe(400)
  })

  it('stores the key encrypted and only shows its end', async () => {
    expect(await (await save(owner)).json()).toEqual({
      provider: 'openrouter',
      model: 'openai/gpt-5.4-mini',
      keyHint: 'sk-or-…1234',
      sharedFamilyIds: [],
    })
    expect(await cipher()).not.toContain(KEY)
    expect(await decryptKey(SECRET, await cipher())).toBe(KEY)
    // Changing only the model keeps the saved key.
    await save(owner, 'zeta/model', null)
    expect(await decryptKey(SECRET, await cipher())).toBe(KEY)
  })

  it('shares with families the user is in, and families pick whose to use', async () => {
    const res = await t.send('PUT', '/api/ai/shares', owner, { familyIds: [familyId] })
    expect(await res.json()).toMatchObject({ sharedFamilyIds: [familyId] })
    const outside = await t.send('PUT', '/api/ai/shares', owner, {
      familyIds: ['01J00000000000000000000000'],
    })
    expect(outside.status).toBe(403)

    // A second member shares too; the earliest stays in use until a manager picks.
    const aunt = await t.signIn('阿姨')
    const invite = await t.send('POST', `/api/families/${familyId}/invites`, owner, {
      role: 'caregiver',
      babyIds: null,
    })
    const { code } = (await invite.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, aunt.headers)
    await save(aunt.headers)
    await t.send('PUT', '/api/ai/shares', aunt.headers, { familyIds: [familyId] })
    const shared = (await family(aunt.headers)) as { inUse: string; shares: { name: string }[] }
    expect(shared.shares.map((share) => share.name)).toEqual(['测试家长', '阿姨'])
    expect(shared.inUse).not.toBe(aunt.user.id)

    const denied = await t.send('PUT', `/api/families/${familyId}/ai`, aunt.headers, {
      userId: aunt.user.id,
    })
    expect(denied.status).toBe(403)
    const picked = await t.send('PUT', `/api/families/${familyId}/ai`, owner, {
      userId: aunt.user.id,
    })
    expect(await picked.json()).toMatchObject({ inUse: aunt.user.id })

    // Leaving the family ends the share.
    await t.send('DELETE', `/api/families/${familyId}/members/${aunt.user.id}`, aunt.headers)
    expect(await family()).toMatchObject({ shares: [{ name: '测试家长' }] })
  })

  it('can be removed, which ends its shares', async () => {
    await t.send('DELETE', '/api/ai', owner)
    expect(await (await t.request('/api/ai', { headers: owner })).json()).toBeNull()
    expect(await family()).toEqual({ inUse: null, shares: [] })
  })
})

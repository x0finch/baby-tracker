import type { Event, PullResponse } from '@bobo/shared'
import { fakeText } from '@tanstack/ai/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { VoiceAction } from '../src/voice/action'
import { clockToTime } from '../src/voice/plan'
import { createTestApp } from './app'
import { baby } from './fixtures'

type Answer = { ok: boolean; done: boolean; confirming: boolean; reply: string }
const answerOf = (res: Response): Promise<Answer> => res.json()

interface Shortcut {
  familyId: string
  familyName: string
  phrase: string
  hasAi: boolean
  token: { createdAt: number; lastUsedAt: number | null } | null
}

const action = (overrides: Partial<VoiceAction>): VoiceAction => ({
  type: 'diaper',
  baby: null,
  time: null,
  minutesAgo: null,
  durationMinutes: null,
  diaper: null,
  amountMl: null,
  milk: null,
  side: null,
  food: null,
  celsius: null,
  medicine: null,
  dose: null,
  text: null,
  ...overrides,
})

describe('siri voice logging', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let headers: Headers
  let familyId: string
  const fake = fakeText()
  // Whose AI the last message asked for, and whether families have one.
  let askedFor: string | undefined
  let aiReady = true

  const siri = (token: string | null, text: string) =>
    t.request('/api/voice/siri', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    })
  /** Says something with the model recording `actions`, then answering `reply`. */
  const record = async (
    token: string,
    text: string,
    actions: VoiceAction[],
    reply = '记好了。',
  ) => {
    fake.setResponses([{ toolCalls: [{ name: 'record', input: { actions } }] }, { text: reply }])
    return answerOf(await siri(token, text))
  }
  const works = async (token: string) =>
    (await record(token, '换尿布', [action({ type: 'diaper' })])).ok
  const newToken = async (h = headers, family = familyId) => {
    const res = await t.send('POST', `/api/voice/families/${family}/token`, h, {
      timeZone: 'Asia/Shanghai',
    })
    expect(res.status).toBe(200)
    return (await res.json()) as { id: string; token: string }
  }
  const shortcuts = async (h = headers) => {
    const res = await t.request('/api/voice', { headers: h })
    const view: { shortcuts: Shortcut[] } = await res.json()
    return view.shortcuts
  }
  const events = async (h = headers) => {
    const res = await t.request('/api/sync/pull?cursor=', { headers: h })
    const page = (await res.json()) as PullResponse
    return page.events.filter((event: Event) => event.deletedAt === null)
  }

  beforeAll(async () => {
    t = await createTestApp(
      {},
      {
        voiceAdapter: async (_env, asked) => {
          askedFor = asked
          return aiReady ? fake : null
        },
      },
    )
    headers = (await t.signIn()).headers
    const res = await t.send('POST', '/api/families', headers, { name: '我们家' })
    const family: { id: string } = await res.json()
    familyId = family.id
    await t.send('POST', '/api/sync/push', headers, {
      babies: [baby(familyId, { name: '小米粒' })],
      events: [],
    })
  })
  afterAll(() => t.dispose())
  beforeEach(() => {
    aiReady = true
  })

  it('shows one shortcut per family, with the code only when created', async () => {
    expect(await shortcuts()).toEqual([
      { familyId, familyName: '我们家', phrase: '记录宝宝', hasAi: false, token: null },
    ])
    const res = await t.send('PATCH', `/api/voice/families/${familyId}`, headers, {
      phrase: '宝宝日记',
    })
    expect(await res.json()).toMatchObject({ shortcuts: [{ phrase: '宝宝日记' }] })
    const { token } = await newToken()
    expect(token).toMatch(/^bobo_/)
    const [shortcut] = await shortcuts()
    expect(shortcut?.token?.createdAt).toBeTypeOf('number')
    expect(JSON.stringify(shortcut)).not.toContain(token)
    await t.send('PATCH', `/api/voice/families/${familyId}`, headers, { phrase: '记录宝宝' })
  })

  it('takes the code with or without the Bearer scheme', async () => {
    const { token } = await newToken()
    fake.setResponses([{ text: '你好。' }])
    const res = await t.request('/api/voice/siri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ text: '你好' }),
    })
    expect(await answerOf(res)).toEqual({
      ok: true,
      done: false,
      confirming: false,
      reply: '你好。',
    })
  })

  it('needs a valid code', async () => {
    expect((await answerOf(await siri(null, '换尿布'))).ok).toBe(false)
    const res = await siri('bobo_nope', '换尿布')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: false,
      done: true,
      confirming: false,
      reply: expect.stringContaining('口令已失效'),
    })
  })

  it('records what was said and syncs it to the app', async () => {
    const { token } = await newToken()
    const earlier = new Set((await events()).map((event) => event.id))
    const result = await record(token, '小米粒换尿布了，还喝了120毫升奶', [
      action({ type: 'diaper', baby: '小米粒' }),
      action({ type: 'bottle', baby: '小米粒', amountMl: 120, milk: 'formula' }),
    ])
    expect(result).toMatchObject({ ok: true, done: false, reply: '记好了。' })
    expect(askedFor).toBe(familyId)
    const stored = (await events()).filter((event) => !earlier.has(event.id))
    expect(stored.map((event) => event.type).toSorted()).toEqual(['diaper', 'feeding'])
    expect(stored.every((event) => event.createdBy !== null)).toBe(true)
  })

  it('ends when the agent says the user is done, or when there is no AI', async () => {
    const { token } = await newToken()
    fake.setResponses([
      { toolCalls: [{ name: 'end_conversation', input: {} }] },
      { text: '好的，再见。' },
    ])
    expect(await answerOf(await siri(token, '没有了'))).toMatchObject({ ok: true, done: true })
    aiReady = false
    const noAi = await answerOf(await siri(token, '换尿布'))
    expect(noAi).toMatchObject({ done: true, reply: expect.stringMatching(/还没设置 AI 模型/) })
  })

  it('chats in the app, in the same conversation as Siri', async () => {
    const { token } = await newToken()
    await record(token, '换尿布', [action({ type: 'diaper' })], '记好了，还有吗？')
    fake.setResponses([{ text: '今天换了几次尿布。' }])
    const res = await t.send('POST', `/api/voice/families/${familyId}/chat`, headers, {
      text: '今天怎么样',
    })
    expect(await res.json()).toEqual({
      reply: '今天换了几次尿布。',
      done: false,
      confirming: false,
    })
    const chat = await t.request(`/api/voice/families/${familyId}/chat`, { headers })
    const { messages } = (await chat.json()) as { messages: Array<{ role: string; text: string }> }
    expect(messages.slice(-4)).toEqual([
      { role: 'user', text: '换尿布' },
      { role: 'assistant', text: '记好了，还有吗？' },
      { role: 'user', text: '今天怎么样' },
      { role: 'assistant', text: '今天换了几次尿布。' },
    ])
  })

  it('asks before deleting and waits for yes', async () => {
    const [stored] = await events()
    fake.setResponses([{ toolCalls: [{ name: 'delete_event', input: { id: stored?.id } }] }])
    const ask = await t.send('POST', `/api/voice/families/${familyId}/chat`, headers, {
      text: '删掉刚才那条',
    })
    expect(await ask.json()).toMatchObject({
      confirming: true,
      reply: expect.stringMatching(/^要删除/),
    })
    const before = (await events()).length
    fake.setResponses([{ text: '删掉了。' }])
    await t.send('POST', `/api/voice/families/${familyId}/chat`, headers, { text: '确定' })
    expect(await events()).toHaveLength(before - 1)
  })

  it('stops working when revoked or replaced', async () => {
    const first = await newToken()
    const second = await newToken()
    expect(await works(first.token)).toBe(false)
    // Revoking an old id (a device signing out) leaves the current code alone.
    await t.send('DELETE', `/api/voice/tokens/${first.id}`, headers)
    expect(await works(second.token)).toBe(true)
    await t.send('DELETE', `/api/voice/families/${familyId}/token`, headers)
    expect(await works(second.token)).toBe(false)
  })

  it('stops working when the password changes', async () => {
    const parent = await t.signIn('爸爸')
    const res = await t.send('POST', '/api/families', parent.headers, { name: '爸爸家' })
    const own: { id: string } = await res.json()
    const ctx = await t.auth.$context
    const userId = parent.user.id
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: 'old',
    })
    const { token } = await newToken(parent.headers, own.id)
    fake.setResponses([{ text: '你好。' }])
    expect((await answerOf(await siri(token, '你好'))).ok).toBe(true)
    await ctx.internalAdapter.updatePassword(userId, 'new')
    expect((await answerOf(await siri(token, '你好'))).reply).toMatch(/口令已失效/)
  })

  it('gives each family its own shortcut, code and AI', async () => {
    // Also a member of grandma's family, with its own baby.
    const grandma = await t.signIn('外婆')
    const res = await t.send('POST', '/api/families', grandma.headers, { name: '外婆家' })
    const other: { id: string } = await res.json()
    await t.send('POST', '/api/sync/push', grandma.headers, {
      babies: [baby(other.id, { name: '小豆子' })],
      events: [],
    })
    const invite = await t.send('POST', `/api/families/${other.id}/invites`, grandma.headers, {
      role: 'caregiver',
      babyIds: null,
    })
    const { code } = (await invite.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, headers)

    expect((await shortcuts()).map((shortcut) => shortcut.phrase)).toEqual([
      '记录宝宝',
      '记录外婆家',
    ])
    const taken = await t.send('PATCH', `/api/voice/families/${other.id}`, headers, {
      phrase: '记录宝宝',
    })
    expect(taken.status).toBe(409)

    const ours = await newToken()
    const theirs = await newToken(headers, other.id)
    const refused = await record(ours.token, '小豆子换尿布', [
      action({ type: 'diaper', baby: '小豆子' }),
    ])
    expect(askedFor).toBe(familyId)
    expect(refused.ok).toBe(true)
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(0)

    await record(theirs.token, '小豆子换尿布', [action({ type: 'diaper', baby: '小豆子' })])
    expect(askedFor).toBe(other.id)
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(1)
  })

  it('cannot add a shortcut for a family the user is not in, or only views', async () => {
    const res = await t.send(
      'POST',
      '/api/voice/families/01J00000000000000000000000/token',
      headers,
      {},
    )
    expect(res.status).toBe(403)

    const viewer = await t.signIn('奶奶')
    const invite = await t.send('POST', `/api/families/${familyId}/invites`, headers, {
      role: 'viewer',
      babyIds: null,
    })
    const { code } = (await invite.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, viewer.headers)
    expect(await shortcuts(viewer.headers)).toEqual([])
    const denied = await t.send('POST', `/api/voice/families/${familyId}/token`, viewer.headers, {})
    expect(denied.status).toBe(403)
  })
})

describe('clock times', () => {
  const now = Date.UTC(2026, 9, 17, 2, 0) // 10:00 in Shanghai
  it('reads clock times in the user zone, yesterday if still ahead', () => {
    expect(clockToTime('09:30', now, 'Asia/Shanghai')).toBe(Date.UTC(2026, 9, 17, 1, 30))
    expect(clockToTime('23:00', now, 'Asia/Shanghai')).toBe(Date.UTC(2026, 9, 16, 15, 0))
    expect(clockToTime('25:00', now, 'Asia/Shanghai')).toBeNull()
  })
})

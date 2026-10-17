import type { Event, PullResponse } from '@bobo/shared'
import { fakeText } from '@tanstack/ai/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { VoiceAction } from '../src/voice/action'
import { clockToTime } from '../src/voice/plan'
import { createTestApp } from './app'
import { baby } from './fixtures'

type Answer = { ok: boolean; done: boolean; confirming: boolean; reply: string }
const answerOf = (res: Response): Promise<Answer> => res.json()

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

const AI = { provider: 'openrouter', model: 'openai/gpt-5.4-mini', apiKey: 'sk-or-v1-0123456789' }

describe('siri voice logging', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let headers: Headers
  let familyId: string
  const fake = fakeText()
  // The model the last message ran on (by saved key hint), and what it was told.
  let usedKey: string | undefined
  let system = ''

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
    fake.setResponses([
      ({ request }) => {
        system = JSON.stringify(request.systemPrompts ?? [])
        return { toolCalls: [{ name: 'record', input: { actions } }] }
      },
      { text: reply },
    ])
    return answerOf(await siri(token, text))
  }
  const works = async (token: string) =>
    (await record(token, '换尿布', [action({ type: 'diaper' })])).ok
  const newToken = async (h = headers) => {
    const res = await t.send('POST', '/api/voice/token', h, { timeZone: 'Asia/Shanghai' })
    expect(res.status).toBe(200)
    return (await res.json()) as { id: string; token: string }
  }
  const events = async (h = headers) => {
    const res = await t.request('/api/sync/pull?cursor=', { headers: h })
    const page = (await res.json()) as PullResponse
    return page.events.filter((event: Event) => event.deletedAt === null)
  }
  const newFamily = async (h: Headers, name: string, babyName: string) => {
    const res = await t.send('POST', '/api/families', h, { name })
    const created: { id: string } = await res.json()
    await t.send('POST', '/api/sync/push', h, {
      babies: [baby(created.id, { name: babyName })],
      events: [],
    })
    return created.id
  }
  const join = async (inviter: Headers, family: string, joiner: Headers, role = 'caregiver') => {
    const invite = await t.send('POST', `/api/families/${family}/invites`, inviter, {
      role,
      babyIds: null,
    })
    const { code } = (await invite.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, joiner)
  }

  beforeAll(async () => {
    t = await createTestApp(
      { AI_KEY_SECRET: 'test-ai-key-secret-test-ai-key-secret' },
      {
        voiceAdapter: async (_env, ai) => {
          usedKey = ai.keyHint
          return fake
        },
      },
    )
    headers = (await t.signIn()).headers
    familyId = await newFamily(headers, '我们家', '小米粒')
  })
  afterAll(() => t.dispose())

  it('answers that there is no AI yet', async () => {
    const { token } = await newToken()
    const result = await answerOf(await siri(token, '换尿布'))
    expect(result).toMatchObject({ done: true, reply: expect.stringMatching(/还没有可用的 AI/) })
    const settings: unknown = await (await t.request('/api/voice', { headers })).json()
    expect(settings).toMatchObject({ ai: null })
    await t.send('PUT', '/api/ai', headers, AI)
  })

  it('keeps the phrase and shows the code only when created', async () => {
    let res = await t.request('/api/voice', { headers })
    expect(await res.json()).toMatchObject({ phrase: '记录宝宝', ai: { kind: 'own' } })
    res = await t.send('PATCH', '/api/voice', headers, { phrase: '宝宝日记' })
    expect(await res.json()).toMatchObject({ phrase: '宝宝日记' })
    const { token } = await newToken()
    expect(token).toMatch(/^bobo_/)
    res = await t.request('/api/voice', { headers })
    const settings = (await res.json()) as { token: { createdAt: number } | null }
    expect(settings.token?.createdAt).toBeTypeOf('number')
    expect(JSON.stringify(settings)).not.toContain(token)
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
      next: 'ask',
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
      next: 'stop',
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
    const stored = (await events()).filter((event) => !earlier.has(event.id))
    expect(stored.map((event) => event.type).toSorted()).toEqual(['diaper', 'feeding'])
    expect(stored.every((event) => event.createdBy !== null)).toBe(true)
  })

  it('ends when the agent says the user is done', async () => {
    const { token } = await newToken()
    fake.setResponses([
      { toolCalls: [{ name: 'end_conversation', input: {} }] },
      { text: '好的，再见。' },
    ])
    expect(await answerOf(await siri(token, '没有了'))).toMatchObject({ ok: true, done: true })
  })

  it('chats in the app, in the same conversation as Siri', async () => {
    const { token } = await newToken()
    await record(token, '换尿布', [action({ type: 'diaper' })], '记好了，还有吗？')
    fake.setResponses([{ text: '今天换了几次尿布。' }])
    const res = await t.send('POST', '/api/voice/chat', headers, { text: '今天怎么样' })
    expect(await res.json()).toEqual({
      reply: '今天换了几次尿布。',
      done: false,
      confirming: false,
    })
    const chat = await t.request('/api/voice/chat', { headers })
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
    const ask = await t.send('POST', '/api/voice/chat', headers, { text: '删掉刚才那条' })
    expect(await ask.json()).toMatchObject({
      confirming: true,
      reply: expect.stringMatching(/^要删除/),
    })
    const before = (await events()).length
    fake.setResponses([{ text: '删掉了。' }])
    await t.send('POST', '/api/voice/chat', headers, { text: '确定' })
    expect(await events()).toHaveLength(before - 1)
  })

  it('stops working when revoked or replaced', async () => {
    const first = await newToken()
    const second = await newToken()
    expect(await works(first.token)).toBe(false)
    // Revoking an old id (a device signing out) leaves the current code alone.
    await t.send('DELETE', `/api/voice/tokens/${first.id}`, headers)
    expect(await works(second.token)).toBe(true)
    await t.send('DELETE', '/api/voice/token', headers)
    expect(await works(second.token)).toBe(false)
  })

  it('stops working when the password changes', async () => {
    const parent = await t.signIn('爸爸')
    await newFamily(parent.headers, '爸爸家', '小核桃')
    await t.send('PUT', '/api/ai', parent.headers, AI)
    const ctx = await t.auth.$context
    const userId = parent.user.id
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: 'old',
    })
    const { token } = await newToken(parent.headers)
    fake.setResponses([{ text: '你好。' }])
    expect((await answerOf(await siri(token, '你好'))).ok).toBe(true)
    await ctx.internalAdapter.updatePassword(userId, 'new')
    expect((await answerOf(await siri(token, '你好'))).reply).toMatch(/口令已失效/)
  })

  it('records in every family with your own key, telling same names apart', async () => {
    const grandma = await t.signIn('外婆')
    const other = await newFamily(grandma.headers, '外婆家', '小豆子')
    await t.send('POST', '/api/sync/push', grandma.headers, {
      babies: [baby(other, { name: '小米粒' })],
      events: [],
    })
    await join(grandma.headers, other, headers)
    const { token } = await newToken()

    await record(token, '小豆子换尿布', [action({ type: 'diaper', baby: '小豆子' })])
    expect(system).toContain('小米粒（我们家）')
    expect(system).toContain('小米粒（外婆家）')
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(1)

    const which = await record(token, '小米粒换尿布', [action({ type: 'diaper', baby: '小米粒' })])
    expect(which.ok).toBe(true)
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(1)
    await record(token, '外婆家的小米粒换尿布', [
      action({ type: 'diaper', baby: '小米粒（外婆家）' }),
    ])
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(2)
  })

  it('without a key of your own, records only in the family that shared one', async () => {
    const aunt = await t.signIn('阿姨')
    await join(headers, familyId, aunt.headers)
    const grandma = await t.signIn('奶奶')
    const theirs = await newFamily(grandma.headers, '奶奶家', '小橙子')
    await join(grandma.headers, theirs, aunt.headers)
    // Grandma's family is joined later but is the only one with a shared AI.
    await t.send('PUT', '/api/ai', grandma.headers, { ...AI, apiKey: 'sk-or-v1-grandma-key' })
    await t.send('PUT', '/api/ai/shares', grandma.headers, { familyIds: [theirs] })

    const settings = await (await t.request('/api/voice', { headers: aunt.headers })).json()
    expect(settings).toMatchObject({ ai: { kind: 'shared', familyName: '奶奶家', by: '奶奶' } })
    const { token } = await newToken(aunt.headers)
    const ours = (await events()).length
    await record(token, '小米粒换尿布', [action({ type: 'diaper', baby: '小米粒' })])
    expect(usedKey).toMatch(/-key$/)
    expect(system).not.toContain('小米粒')
    expect(system).toContain('只能记这个家庭')
    expect(await events()).toHaveLength(ours)
    await record(token, '小橙子换尿布', [action({ type: 'diaper', baby: '小橙子' })])
    expect((await events(grandma.headers)).filter((e) => e.type === 'diaper')).toHaveLength(1)
  })

  it('answers viewers that there is nothing to record', async () => {
    const viewer = await t.signIn('邻居')
    await join(headers, familyId, viewer.headers, 'viewer')
    const { token } = await newToken(viewer.headers)
    expect((await answerOf(await siri(token, '换尿布'))).reply).toBe('还没有可以记录的家庭。')
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

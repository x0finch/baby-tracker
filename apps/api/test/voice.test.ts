import type { Event, PullResponse } from '@bobo/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { VoiceAction, VoiceParse } from '../src/voice/parse'
import { clockToTime } from '../src/voice/plan'
import { createTestApp } from './app'
import { baby } from './fixtures'

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
  // What the fake model returns for the next sentence; the last context it was given.
  let next: VoiceParse = { actions: [], unclear: true }
  let seen: { text: string; babyNames: string[]; localNow: string } | undefined

  const siri = (token: string | null, text: string) =>
    t.request('/api/voice/siri', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    })
  const say = async (token: string, text: string, parse: VoiceParse) => {
    next = parse
    const res = await siri(token, text)
    return { status: res.status, ...((await res.json()) as { reply: string; records: string[] }) }
  }
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

  beforeAll(async () => {
    t = await createTestApp(
      {},
      {
        voiceParser: () => async (context) => {
          seen = context
          return next
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
    seen = undefined
  })

  it('keeps the phrase and shows the code only when created', async () => {
    let res = await t.request('/api/voice', { headers })
    expect(await res.json()).toEqual({ phrase: '记录宝宝', token: null })
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
    next = { unclear: false, actions: [action({ type: 'diaper' })] }
    const res = await t.request('/api/voice/siri', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ text: '换尿布' }),
    })
    expect(res.status).toBe(200)
  })

  it('needs a valid code', async () => {
    expect((await siri(null, '换尿布')).status).toBe(401)
    const res = await siri('bobo_nope', '换尿布')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ reply: expect.stringContaining('口令已失效'), records: [] })
  })

  it('records what was said and syncs it to the app', async () => {
    const { token } = await newToken()
    const earlier = new Set((await events()).map((event) => event.id))
    const result = await say(token, '小米粒换尿布了，还喝了120毫升奶', {
      unclear: false,
      actions: [
        action({ type: 'diaper', baby: '小米粒' }),
        action({ type: 'bottle', baby: '小米粒', amountMl: 120, milk: 'formula' }),
      ],
    })
    expect(result.status).toBe(200)
    expect(result.reply).toMatch(
      /^已记录：小米粒 \d\d:\d\d 换尿布（尿尿）；小米粒 \d\d:\d\d 瓶喂 120 毫升（配方奶）$/,
    )
    expect(seen?.babyNames).toEqual(['小米粒'])
    const stored = (await events()).filter((event) => !earlier.has(event.id))
    expect(stored.map((event) => event.type).toSorted()).toEqual(['diaper', 'feeding'])
    expect(stored.every((event) => event.createdBy !== null)).toBe(true)
  })

  it('undoes the last command', async () => {
    const { token } = await newToken()
    const before = (await events()).length
    await say(token, '换尿布', { unclear: false, actions: [action({ type: 'diaper' })] })
    expect(await events()).toHaveLength(before + 1)
    const undone = await say(token, '撤销', { unclear: false, actions: [action({ type: 'undo' })] })
    expect(undone.reply).toMatch(/^已撤销：/)
    expect(await events()).toHaveLength(before)
    const again = await say(token, '撤销', { unclear: false, actions: [action({ type: 'undo' })] })
    expect(again.reply).toBe('没有可以撤销的记录。')
  })

  it('starts and ends a sleep', async () => {
    const { token } = await newToken()
    await say(token, '睡着了', {
      unclear: false,
      actions: [action({ type: 'sleep', minutesAgo: 30 })],
    })
    const again = await say(token, '睡着了', {
      unclear: false,
      actions: [action({ type: 'sleep' })],
    })
    expect(again.reply).toBe('小米粒已经在睡了。')
    const woke = await say(token, '醒了', { unclear: false, actions: [action({ type: 'wake' })] })
    expect(woke.reply).toMatch(/醒了（睡了 30 分钟）/)
    const sleep = (await events()).find((event) => event.type === 'sleep')
    expect(sleep?.endAt).not.toBeNull()
    const none = await say(token, '醒了', { unclear: false, actions: [action({ type: 'wake' })] })
    expect(none.reply).toBe('小米粒现在没有在睡觉。')
  })

  it('asks instead of guessing', async () => {
    const { token } = await newToken()
    expect((await say(token, '你好', { unclear: true, actions: [] })).reply).toMatch(/没听懂/)
    const bottle = await say(token, '喂奶', {
      unclear: false,
      actions: [action({ type: 'bottle' })],
    })
    expect(bottle.reply).toMatch(/多少毫升/)
    const who = await say(token, '小豆子换尿布', {
      unclear: false,
      actions: [action({ type: 'diaper', baby: '小豆子' })],
    })
    expect(who.reply).toBe('没找到叫「小豆子」的宝宝。')
  })

  it('previews without recording', async () => {
    const before = (await events()).length
    next = { unclear: false, actions: [action({ type: 'temperature', celsius: 37.56 })] }
    const res = await t.send('POST', '/api/voice/preview', headers, { text: '体温37.6' })
    const preview = (await res.json()) as { reply: string; records: string[] }
    expect(preview.reply).toMatch(/^会记录：小米粒 \d\d:\d\d 体温 37.6°C$/)
    expect(preview.records).toHaveLength(1)
    expect(await events()).toHaveLength(before)
  })

  it('stops working when revoked or replaced', async () => {
    const first = await newToken()
    const second = await newToken()
    expect((await siri(first.token, '换尿布')).status).toBe(401)
    // Revoking someone else's id (an old device signing out) leaves the current code alone.
    await t.send('DELETE', `/api/voice/token?id=${first.id}`, headers)
    next = { unclear: false, actions: [action({ type: 'diaper' })] }
    expect((await siri(second.token, '换尿布')).status).toBe(200)
    await t.send('DELETE', `/api/voice/token?id=${second.id}`, headers)
    expect((await siri(second.token, '换尿布')).status).toBe(401)
  })

  it('stops working when the password changes', async () => {
    const parent = await t.signIn('爸爸')
    const ctx = await t.auth.$context
    const userId = parent.user.id
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: 'old',
    })
    const { token } = await newToken(parent.headers)
    next = { unclear: false, actions: [action({ type: 'diaper' })] }
    expect((await siri(token, '换尿布')).status).toBe(200)
    await ctx.internalAdapter.updatePassword(userId, 'new')
    expect((await siri(token, '换尿布')).status).toBe(401)
  })

  it('refuses viewers', async () => {
    const viewer = await t.signIn('外婆')
    const res = await t.send('POST', `/api/families/${familyId}/invites`, headers, {
      role: 'viewer',
      babyIds: null,
    })
    const { code } = (await res.json()) as { code: string }
    await t.send('POST', `/api/invites/${code}/accept`, viewer.headers)
    const { token } = await newToken(viewer.headers)
    const result = await say(token, '换尿布', {
      unclear: false,
      actions: [action({ type: 'diaper' })],
    })
    expect(result.reply).toBe('还没有可以记录的宝宝。')
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

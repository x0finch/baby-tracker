import { fakeText } from '@tanstack/ai/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asksQuestion, judge, report, runScenario } from '../evals/harness'
import type { Scenario } from '../evals/scenarios'
import { createTestApp } from './app'

// The eval harness runs against real models only on request; this keeps it working.

const bottle = (amountMl: number) => ({
  type: 'bottle',
  baby: null,
  time: null,
  minutesAgo: null,
  durationMinutes: null,
  diaper: null,
  amountMl,
  milk: 'formula',
  side: null,
  food: null,
  celsius: null,
  medicine: null,
  dose: null,
  text: null,
})

const misheard: Scenario = {
  name: '新生儿 500 毫升',
  category: 'misheard',
  ageDays: 17,
  history: { bottleMl: 60, perDay: 9 },
  turns: [
    { say: '喝了五百毫升奶粉', expect: { asks: true } },
    {
      say: '是五十',
      expect: { records: { type: 'feeding', data: { kind: 'bottle', amountMl: 50 } } },
    },
  ],
}

describe('eval harness', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(() => t.dispose())

  it('tells a question from the usual "还有吗"', () => {
    expect(asksQuestion('是 50 毫升吗？')).toBe(true)
    expect(asksQuestion('记好了，喝了 60 毫升。还有吗？')).toBe(false)
    expect(asksQuestion('记好了。还有别的要记的吗？')).toBe(false)
  })

  it('judges asking and recording from the reply and what was added', () => {
    const added = [{ type: 'feeding', data: { kind: 'bottle', amountMl: 500 } }]
    expect(judge({ asks: true }, '是 50 毫升吗？', [])).toEqual({ pass: true })
    expect(judge({ asks: true }, '记好了。', added).why).toBe('没有先问就记了')
    const fifty = { records: { type: 'feeding', data: { kind: 'bottle', amountMl: 50 } } }
    expect(judge(fifty, '是 50 毫升吗？', []).why).toBe('不该问却问了')
    expect(judge(fifty, '记好了。', added).why).toBe('记的内容不对')
  })

  it('plays a scenario turn by turn against the real tools and reports it', async () => {
    const fake = fakeText()
    fake.setResponses([
      { toolCalls: [{ name: 'record', input: { actions: [bottle(500)], confirmed: false } }] },
      { text: '五百毫升有点多，是 50 毫升吗？' },
      { toolCalls: [{ name: 'record', input: { actions: [bottle(50)], confirmed: false } }] },
      { text: '记好了，50 毫升。还有吗？' },
    ])
    const passed = await runScenario(t, fake, 'fake', misheard)
    expect(passed.pass).toBe(true)
    expect(passed.turns.map((turn) => turn.added.length)).toEqual([0, 1])

    fake.setResponses([
      { toolCalls: [{ name: 'record', input: { actions: [bottle(500)], confirmed: true } }] },
      { text: '记好了。还有吗？' },
    ])
    const failed = await runScenario(t, fake, 'fake', misheard)
    expect(failed.pass).toBe(false)
    expect(failed.turns).toHaveLength(1)

    const markdown = report([passed, failed], 1)
    expect(markdown).toContain('| fake | 50%（1/2） | – | – | 50%（1/2） | 0 |')
    expect(markdown).toContain('没有先问就记了')
  })

  it('counts a failed model call apart from a wrong answer', async () => {
    const fake = fakeText()
    fake.setResponses([() => Promise.reject(new Error('402 needs more credits'))])
    const result = await runScenario(t, fake, 'broke', misheard)
    expect(result.error ?? result.turns[0]?.why).toBeTruthy()
    const markdown = report([result], 1)
    expect(markdown).toContain('| broke | – | – | – | – | 1 |')
    expect(markdown).toContain('## 调用出错')
    expect(markdown).not.toContain('## 没通过的')
  })
})

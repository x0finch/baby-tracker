// What the voice assistant should do when speech recognition may have misheard. Each scenario
// sets up one baby (its age and last week of bottle feeds) and plays what the parent says,
// turn by turn, with what the assistant should do after each turn.

/** A record the turn should add, as a partial match ("bottle of 50 ml"). */
export interface RecordMatch {
  type: string
  data?: Record<string, unknown>
}

export type Expect =
  /** Ask before recording: a question in the reply, and none of these records added. */
  | { asks: true; forbid?: RecordMatch }
  /** Record this, without asking first. */
  | { records: RecordMatch }

export interface Turn {
  say: string
  expect: Expect
}

export type Category =
  /** Likely misheard: the assistant should ask. */
  | 'misheard'
  /** Plausible: the assistant should record without asking. */
  | 'plausible'
  /** Asked, then the parent answers. */
  | 'follow-up'

export interface Scenario {
  name: string
  category: Category
  /** Age in days today. */
  ageDays: number
  /** Last week's bottle feeds: usual amount and feeds a day. Omitted: no records yet. */
  history?: { bottleMl: number; perDay: number }
  turns: Turn[]
}

const bottle = (amountMl: number): RecordMatch => ({
  type: 'feeding',
  data: { kind: 'bottle', amountMl },
})
const anyBottle: RecordMatch = { type: 'feeding', data: { kind: 'bottle' } }
const asks = (forbid?: RecordMatch): Expect => ({ asks: true, ...(forbid ? { forbid } : {}) })
const records = (match: RecordMatch): Expect => ({ records: match })

const NEWBORN = 17
const MONTH = 30

export const SCENARIOS: Scenario[] = [
  // Misheard: far outside the age's usual amounts or the baby's own habit.
  {
    name: '新生儿 500 毫升（五十）',
    category: 'misheard',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [{ say: '喝了五百毫升奶粉', expect: asks() }],
  },
  {
    name: '新生儿 600 毫升（六十）',
    category: 'misheard',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [{ say: '喂了六百毫升', expect: asks() }],
  },
  {
    name: '1 个月 900 毫升（九十）',
    category: 'misheard',
    ageDays: MONTH + 5,
    history: { bottleMl: 90, perDay: 8 },
    turns: [{ say: '喝了九百毫升奶粉', expect: asks() }],
  },
  {
    name: '2 个月 1200 毫升（一百二）',
    category: 'misheard',
    ageDays: 2 * MONTH + 10,
    history: { bottleMl: 120, perDay: 7 },
    turns: [{ say: '喝了一千二百毫升', expect: asks() }],
  },
  {
    name: '3 个月 15 毫升，平时 150（一百五）',
    category: 'misheard',
    ageDays: 3 * MONTH + 8,
    history: { bottleMl: 150, perDay: 7 },
    turns: [{ say: '喝了十五毫升奶粉', expect: asks() }],
  },
  {
    name: '4 个月 16 毫升，平时 160（一百六）',
    category: 'misheard',
    ageDays: 4 * MONTH + 2,
    history: { bottleMl: 160, perDay: 6 },
    turns: [{ say: '喝了十六毫升', expect: asks() }],
  },
  {
    name: '5 个月 8 毫升，平时 180',
    category: 'misheard',
    ageDays: 5 * MONTH + 12,
    history: { bottleMl: 180, perDay: 6 },
    turns: [{ say: '喝了八毫升奶', expect: asks() }],
  },
  {
    name: '6 个月 2000 毫升（两百）',
    category: 'misheard',
    ageDays: 6 * MONTH + 3,
    history: { bottleMl: 200, perDay: 5 },
    turns: [{ say: '喝了两千毫升', expect: asks() }],
  },
  {
    name: '7 个月 21 毫升，平时 210',
    category: 'misheard',
    ageDays: 7 * MONTH + 15,
    history: { bottleMl: 210, perDay: 5 },
    turns: [{ say: '喝了二十一毫升配方奶', expect: asks() }],
  },
  {
    name: '9 个月 22 毫升，平时 220',
    category: 'misheard',
    ageDays: 9 * MONTH + 4,
    history: { bottleMl: 220, perDay: 4 },
    turns: [{ say: '喝了二十二毫升', expect: asks() }],
  },
  {
    name: '2 个月吃米粉',
    category: 'misheard',
    ageDays: 2 * MONTH + 6,
    history: { bottleMl: 120, perDay: 7 },
    turns: [{ say: '吃了一碗米粉', expect: asks() }],
  },
  {
    name: '1 个月睡了 20 小时',
    category: 'misheard',
    ageDays: MONTH + 10,
    turns: [{ say: '宝宝刚才睡了二十个小时', expect: asks() }],
  },
  {
    name: '3 个月亲喂 3 小时',
    category: 'misheard',
    ageDays: 3 * MONTH,
    turns: [{ say: '亲喂了三个小时', expect: asks() }],
  },
  {
    name: '体温 48 度',
    category: 'misheard',
    ageDays: 4 * MONTH,
    turns: [{ say: '量了体温四十八度', expect: asks() }],
  },
  {
    name: '吸奶 1000 毫升',
    category: 'misheard',
    ageDays: NEWBORN,
    turns: [{ say: '吸奶一千毫升', expect: asks() }],
  },
  {
    name: '一句两件事，奶量可疑',
    category: 'misheard',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [{ say: '喝了五百毫升奶粉，换了尿布', expect: asks(bottle(500)) }],
  },

  // Plausible: record at once, even when below or above the usual amount.
  {
    name: '新生儿 60 毫升',
    category: 'plausible',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [{ say: '喝了六十毫升奶粉', expect: records(bottle(60)) }],
  },
  {
    name: '新生儿没有记录，40 毫升',
    category: 'plausible',
    ageDays: 5,
    turns: [{ say: '喝了四十毫升', expect: records(bottle(40)) }],
  },
  {
    name: '1 个月 100 毫升 + 尿布',
    category: 'plausible',
    ageDays: MONTH + 5,
    history: { bottleMl: 90, perDay: 8 },
    turns: [{ say: '喝了一百毫升奶粉，换了尿布', expect: records(bottle(100)) }],
  },
  {
    name: '3 个月 160 毫升',
    category: 'plausible',
    ageDays: 3 * MONTH + 8,
    history: { bottleMl: 150, perDay: 7 },
    turns: [{ say: '喝了一百六十毫升', expect: records(bottle(160)) }],
  },
  {
    name: '4 个月 120 毫升，比平时少一点',
    category: 'plausible',
    ageDays: 4 * MONTH + 2,
    history: { bottleMl: 150, perDay: 6 },
    turns: [{ say: '喝了一百二', expect: records(bottle(120)) }],
  },
  {
    name: '5 个月 90 毫升，说了没喝完',
    category: 'plausible',
    ageDays: 5 * MONTH + 12,
    history: { bottleMl: 180, perDay: 6 },
    turns: [{ say: '喝了九十毫升，没喝完就睡了', expect: records(bottle(90)) }],
  },
  {
    name: '6 个月 200 毫升',
    category: 'plausible',
    ageDays: 6 * MONTH + 3,
    history: { bottleMl: 200, perDay: 5 },
    turns: [{ say: '喝了两百毫升', expect: records(bottle(200)) }],
  },
  {
    name: '9 个月 180 毫升',
    category: 'plausible',
    ageDays: 9 * MONTH + 4,
    history: { bottleMl: 220, perDay: 4 },
    turns: [{ say: '喝了一百八', expect: records(bottle(180)) }],
  },
  {
    name: '7 个月吃米粉',
    category: 'plausible',
    ageDays: 7 * MONTH,
    history: { bottleMl: 200, perDay: 5 },
    turns: [{ say: '吃了米粉', expect: records({ type: 'feeding', data: { kind: 'solids' } }) }],
  },
  {
    name: '1 岁吃米饭',
    category: 'plausible',
    ageDays: 12 * MONTH + 20,
    turns: [
      { say: '中午吃了米饭', expect: records({ type: 'feeding', data: { kind: 'solids' } }) },
    ],
  },
  {
    name: '2 个月换尿布有便便',
    category: 'plausible',
    ageDays: 2 * MONTH,
    turns: [{ say: '换了尿布，有便便', expect: records({ type: 'diaper' }) }],
  },
  {
    name: '体温 38.5 度',
    category: 'plausible',
    ageDays: 8 * MONTH,
    turns: [
      {
        say: '体温三十八度五',
        expect: records({ type: 'temperature', data: { celsius: 38.5 } }),
      },
    ],
  },
  {
    name: '新生儿亲喂 20 分钟',
    category: 'plausible',
    ageDays: NEWBORN,
    turns: [
      { say: '亲喂了二十分钟', expect: records({ type: 'feeding', data: { kind: 'breast' } }) },
    ],
  },
  {
    name: '3 个月睡了 2 小时',
    category: 'plausible',
    ageDays: 3 * MONTH,
    turns: [{ say: '刚才睡了两个小时', expect: records({ type: 'sleep' }) }],
  },
  {
    name: '吸奶 120 毫升',
    category: 'plausible',
    ageDays: NEWBORN,
    turns: [
      { say: '吸奶一百二十毫升', expect: records({ type: 'pumping', data: { amountMl: 120 } }) },
    ],
  },
  {
    name: '混合喂养分别说了母乳和奶粉',
    category: 'plausible',
    ageDays: 2 * MONTH,
    turns: [
      {
        say: '喝了母乳六十毫升，奶粉四十毫升',
        expect: records({
          type: 'feeding',
          data: { kind: 'bottle', amountMl: 100, milk: 'mixed', breastMl: 60, formulaMl: 40 },
        }),
      },
    ],
  },
  {
    name: '开始吸奶计时',
    category: 'plausible',
    ageDays: NEWBORN,
    turns: [{ say: '开始吸奶', expect: records({ type: 'pumping' }) }],
  },
  {
    name: '体重 6.2 公斤',
    category: 'plausible',
    ageDays: 3 * MONTH,
    turns: [
      { say: '称了体重六点二公斤', expect: records({ type: 'growth', data: { weightKg: 6.2 } }) },
    ],
  },

  // Follow-up: the assistant asks, then records what the parent's answer says.
  {
    name: '问 15 → 家长纠正 150',
    category: 'follow-up',
    ageDays: 3 * MONTH + 8,
    history: { bottleMl: 150, perDay: 7 },
    turns: [
      { say: '喝了十五毫升奶粉', expect: asks() },
      { say: '不对，是一百五', expect: records(bottle(150)) },
    ],
  },
  {
    name: '问 15 → 家长确认就是 15',
    category: 'follow-up',
    ageDays: 3 * MONTH + 8,
    history: { bottleMl: 150, perDay: 7 },
    turns: [
      { say: '喝了十五毫升奶粉', expect: asks() },
      { say: '对，就十五，他今天不太舒服', expect: records(bottle(15)) },
    ],
  },
  {
    name: '问 500 → 家长说 50',
    category: 'follow-up',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [
      { say: '喝了五百毫升', expect: asks() },
      { say: '是五十', expect: records(bottle(50)) },
    ],
  },
  {
    name: '问 500 → 家长只说"对"',
    category: 'follow-up',
    ageDays: NEWBORN,
    history: { bottleMl: 60, perDay: 9 },
    turns: [
      { say: '喝了五百毫升', expect: asks() },
      { say: '对', expect: records(anyBottle) },
    ],
  },
  {
    name: '问 2000 → 家长说两百',
    category: 'follow-up',
    ageDays: 6 * MONTH + 3,
    history: { bottleMl: 200, perDay: 5 },
    turns: [
      { say: '喝了两千毫升', expect: asks() },
      { say: '两百', expect: records(bottle(200)) },
    ],
  },
  {
    name: '问米粉 → 其实是喝奶',
    category: 'follow-up',
    ageDays: 2 * MONTH + 6,
    history: { bottleMl: 120, perDay: 7 },
    turns: [
      { say: '吃了米粉', expect: asks() },
      { say: '不是，是喝奶，喝了一百毫升', expect: records(bottle(100)) },
    ],
  },
  {
    name: '问亲喂 3 小时 → 30 分钟',
    category: 'follow-up',
    ageDays: 3 * MONTH,
    turns: [
      { say: '亲喂了三个小时', expect: asks() },
      {
        say: '三十分钟',
        expect: records({ type: 'feeding', data: { kind: 'breast' } }),
      },
    ],
  },
  {
    name: '问 16 → 一百六',
    category: 'follow-up',
    ageDays: 4 * MONTH + 2,
    history: { bottleMl: 160, perDay: 6 },
    turns: [
      { say: '喝了十六毫升', expect: asks() },
      { say: '一百六', expect: records(bottle(160)) },
    ],
  },
]

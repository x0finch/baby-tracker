import { type Event, eventSchema, newId } from '@bobo/shared'

import type { VoiceAction } from './action'

const MINUTE = 60_000

export interface VoiceBaby {
  id: string
  name: string
  familyId: string
}

export interface PlanContext {
  /** Babies the user may add records for. */
  babies: VoiceBaby[]
  /** Running sleeps by baby id, for "醒了". */
  runningSleeps: ReadonlyMap<string, Event>
  userId: string
  now: number
  timeZone: string
}

/** One record to write; `before` is the stored version it replaces, or null when added. */
export interface PlannedChange {
  event: Event
  before: Event | null
}

export type Plan =
  | { kind: 'changes'; changes: PlannedChange[]; lines: string[] }
  | { kind: 'undo' }
  | { kind: 'reply'; reply: string }

export const REPLY = {
  unclear: '没听懂，可以再说一遍吗？比如「小米粒换尿布了」。',
  noBabies: '还没有可以记录的宝宝。',
  whichBaby: '是哪个宝宝？请带上名字再说一遍。',
  unknownBaby: (name: string) => `这个家庭里没有叫「${name}」的宝宝。`,
  needAmount: '是多少毫升？请带上量再说一遍。',
  needTemperature: '体温是多少度？请再说一遍。',
  needMedicine: '吃的是什么药？请再说一遍。',
  notSleeping: (name: string) => `${name}现在没有在睡觉。`,
  alreadySleeping: (name: string) => `${name}已经在睡了。`,
  wakeBeforeSleep: (name: string) => `${name}这次睡觉开始得比这个时间晚。`,
}

class Refusal extends Error {}
const refuse = (reply: string): never => {
  throw new Refusal(reply)
}

// Clock times are said in the user's own zone; the server works in UTC.

function zoneParts(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** The zone's offset from UTC at `at`, in ms. */
function zoneOffset(at: number, timeZone: string): number {
  const p = zoneParts(at, timeZone)
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000
  )
}

/** "HH:MM" today in the zone, or yesterday if that is still ahead of now. */
export function clockToTime(clock: string, now: number, timeZone: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  const today = zoneParts(now, timeZone)
  const local = Date.UTC(today.year, today.month - 1, today.day, hour, minute)
  const at = local - zoneOffset(now, timeZone)
  // A few minutes of slack for clocks said slightly ahead ("10:30" at 10:28).
  return at > now + 5 * MINUTE ? at - 24 * 60 * MINUTE : at
}

export function formatClock(at: number, timeZone: string): string {
  const p = zoneParts(at, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-17 21:05 星期五", for the model to resolve times against. */
export function localNow(now: number, timeZone: string): string {
  const p = zoneParts(now, timeZone)
  const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'long' }).format(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)} ${weekday}`
}

function durationLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${minutes} 分钟`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

const DIAPER = { wet: '尿尿', dirty: '便便', mixed: '尿便' } as const
const MILK = { breast: '母乳', formula: '配方奶', mixed: '混合' } as const
const SIDE = { left: '左侧', right: '右侧', both: '双侧' } as const

/** What a record is, in a few words: "换尿布（尿尿）". */
export function describe(event: Event, before: Event | null): string {
  switch (event.type) {
    case 'diaper':
      return `换尿布（${DIAPER[event.data.contents]}）`
    case 'feeding': {
      const { data } = event
      if (data.kind === 'bottle') return `瓶喂 ${data.amountMl} 毫升（${MILK[data.milk]}）`
      if (data.kind === 'solids') return `辅食：${data.food}`
      const side = SIDE[data.segments[0]?.side ?? 'left']
      return event.endAt === null
        ? `开始亲喂（${side}）`
        : `亲喂 ${durationLabel(event.endAt - event.startAt)}`
    }
    case 'sleep':
      if (event.endAt === null) return '开始睡觉'
      return before
        ? `醒了（睡了 ${durationLabel(event.endAt - event.startAt)}）`
        : `睡了 ${durationLabel(event.endAt - event.startAt)}`
    case 'pumping':
      return `吸奶 ${event.data.amountMl} 毫升（${SIDE[event.data.side]}）`
    case 'temperature':
      return `体温 ${event.data.celsius}°C`
    case 'medication':
      return `用药：${event.data.name}${event.data.dose ? ` ${event.data.dose}` : ''}`
    case 'note':
      return `笔记：${event.note ?? ''}`
    default:
      return '生长记录'
  }
}

function pickBaby(action: VoiceAction, babies: VoiceBaby[]): VoiceBaby {
  if (babies.length === 0) refuse(REPLY.noBabies)
  const said = action.baby?.trim()
  if (!said) return babies.length === 1 && babies[0] ? babies[0] : refuse(REPLY.whichBaby)
  return (
    babies.find((baby) => baby.name === said) ??
    babies.find((baby) => said.includes(baby.name) || baby.name.includes(said)) ??
    refuse(REPLY.unknownBaby(said))
  )
}

/** When it happened: a clock time, "N minutes ago", or now. Never in the future. */
function whenOf(action: VoiceAction, context: PlanContext): number {
  const { now, timeZone } = context
  const clock = action.time ? clockToTime(action.time, now, timeZone) : null
  const at =
    clock ?? (action.minutesAgo !== null ? now - Math.max(0, action.minutesAgo) * MINUTE : now)
  return Math.min(at, now)
}

function draft(baby: VoiceBaby, context: PlanContext, startAt: number, endAt: number | null) {
  const { now, userId } = context
  return {
    id: newId(now),
    babyId: baby.id,
    familyId: baby.familyId,
    startAt,
    endAt,
    note: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: userId,
  }
}

/** A new record, validated like a synced one. */
function added(event: unknown): PlannedChange {
  const parsed = eventSchema.safeParse(event)
  return parsed.success ? { event: parsed.data, before: null } : refuse(REPLY.unclear)
}

function changeFor(action: VoiceAction, context: PlanContext): PlannedChange {
  const baby = pickBaby(action, context.babies)
  const at = whenOf(action, context)
  const minutes = action.durationMinutes !== null && action.durationMinutes > 0
  const duration = minutes ? (action.durationMinutes ?? 0) * MINUTE : 0

  switch (action.type) {
    case 'diaper': {
      const contents = action.diaper ?? 'wet'
      const pee = contents === 'dirty' ? {} : { pee: { amount: 'normal' } }
      return added({
        ...draft(baby, context, at, null),
        type: 'diaper',
        data: { contents, ...pee },
      })
    }
    case 'bottle': {
      if (!action.amountMl || action.amountMl <= 0) refuse(REPLY.needAmount)
      const data = {
        kind: 'bottle',
        amountMl: Math.round(action.amountMl ?? 0),
        milk: action.milk ?? 'formula',
      }
      return added({ ...draft(baby, context, at, null), type: 'feeding', data })
    }
    case 'breast': {
      const side = action.side === 'right' ? 'right' : 'left'
      if (!minutes) {
        const segments = [{ side, startAt: at, endAt: null }]
        return added({
          ...draft(baby, context, at, null),
          type: 'feeding',
          data: { kind: 'breast', segments },
        })
      }
      // A finished feed that ended by now; "两边各…" splits it evenly, left first.
      const startAt = Math.min(at, context.now - duration)
      const endAt = startAt + duration
      const segments =
        action.side === 'both'
          ? [
              { side: 'left', startAt, endAt: startAt + Math.round(duration / 2) },
              { side: 'right', startAt: startAt + Math.round(duration / 2), endAt },
            ]
          : [{ side, startAt, endAt }]
      return added({
        ...draft(baby, context, startAt, endAt),
        type: 'feeding',
        data: { kind: 'breast', segments },
      })
    }
    case 'solids':
      return added({
        ...draft(baby, context, at, null),
        type: 'feeding',
        data: { kind: 'solids', food: action.food?.trim() || '辅食' },
      })
    case 'sleep': {
      if (minutes) {
        const startAt = Math.min(at, context.now - duration)
        return added({
          ...draft(baby, context, startAt, startAt + duration),
          type: 'sleep',
          data: { kind: 'nap' },
        })
      }
      if (context.runningSleeps.has(baby.id)) refuse(REPLY.alreadySleeping(baby.name))
      return added({ ...draft(baby, context, at, null), type: 'sleep', data: { kind: 'nap' } })
    }
    case 'wake': {
      const running = context.runningSleeps.get(baby.id) ?? refuse(REPLY.notSleeping(baby.name))
      if (at < running.startAt) refuse(REPLY.wakeBeforeSleep(baby.name))
      const event = { ...running, endAt: at, updatedAt: context.now }
      const parsed = eventSchema.safeParse(event)
      return parsed.success ? { event: parsed.data, before: running } : refuse(REPLY.unclear)
    }
    case 'pumping': {
      if (!action.amountMl || action.amountMl <= 0) refuse(REPLY.needAmount)
      const data = { side: action.side ?? 'both', amountMl: Math.round(action.amountMl ?? 0) }
      return added({ ...draft(baby, context, at, null), type: 'pumping', data })
    }
    case 'temperature': {
      if (action.celsius === null) refuse(REPLY.needTemperature)
      const celsius = Math.round((action.celsius ?? 0) * 10) / 10
      return added({ ...draft(baby, context, at, null), type: 'temperature', data: { celsius } })
    }
    case 'medication': {
      const name = action.medicine?.trim() || refuse(REPLY.needMedicine)
      const data = { name, dose: action.dose?.trim() || null }
      return added({ ...draft(baby, context, at, null), type: 'medication', data })
    }
    case 'note': {
      const note = action.text?.trim() || refuse(REPLY.unclear)
      return added({ ...draft(baby, context, at, null), note, type: 'note', data: {} })
    }
    default:
      // undo is handled before any record is built.
      return refuse(REPLY.unclear)
  }
}

/** Turns parsed actions into checked records, or the reply that explains why not. */
export function planActions(actions: VoiceAction[], context: PlanContext): Plan {
  if (actions.some((action) => action.type === 'undo')) return { kind: 'undo' }
  if (actions.length === 0) return { kind: 'reply', reply: REPLY.unclear }
  try {
    const changes = actions.map((action) => changeFor(action, context))
    const names = new Map(context.babies.map((baby) => [baby.id, baby.name]))
    const lines = changes.map(
      ({ event, before }) =>
        `${names.get(event.babyId) ?? ''} ${formatClock(event.endAt !== null && before ? event.endAt : event.startAt, context.timeZone)} ${describe(event, before)}`,
    )
    return { kind: 'changes', changes, lines }
  } catch (error) {
    if (error instanceof Refusal) return { kind: 'reply', reply: error.message }
    throw error
  }
}

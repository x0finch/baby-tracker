import type { Baby, Reminder, ReminderKind } from '@bobo/shared'
import { useEffect, useState } from 'react'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useBabies } from '../features/babies/use-babies'
import { formatNumber } from '../lib/i18n'
import { m } from '../paraglide/messages.js'
import {
  type PushState,
  disablePush,
  enablePush,
  getPushState,
  refreshPushSubscription,
  reminderApi,
  sendTestNotification,
} from './notifications'
import { useAccess } from './use-access'

/** Interval choices in minutes; 0 turns the reminder off. */
const CHOICES: Record<ReminderKind, number[]> = {
  feeding: [0, 120, 150, 180, 240],
  diaper: [0, 120, 180, 240],
}
const KIND_LABEL: Record<ReminderKind, () => string> = {
  feeding: m.reminderFeeding,
  diaper: m.reminderDiaper,
}
/** Interval kept when a reminder is off, so turning it on again restores it. */
const DEFAULT_MINUTES: Record<ReminderKind, number> = { feeding: 180, diaper: 180 }

const keyOf = (babyId: string, kind: ReminderKind) => `${babyId}:${kind}`

const pushHint: Partial<Record<PushState, () => string>> = {
  unsupported: m.pushUnsupported,
  'needs-install': m.pushNeedsInstall,
  denied: m.pushDenied,
}

/** Device notifications and per-baby "it's been a while" reminders; signed-in users only. */
export function RemindersCard() {
  const { userId } = useAccess()
  if (!userId) return null
  return <Reminders key={userId} />
}

function Reminders() {
  const { active } = useBabies()
  // Reminders run on the server, so only babies that have synced to a family can have them.
  const babies = active.filter((baby) => baby.familyId !== null)
  const [push, setPush] = useState<PushState>()
  const [reminders, setReminders] = useState<ReadonlyMap<string, Reminder>>(new Map())
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void getPushState().then((state) => current && setPush(state))
    void refreshPushSubscription().catch(() => undefined)
    reminderApi.list().then(
      (list) => current && setReminders(new Map(list.map((r) => [keyOf(r.babyId, r.kind), r]))),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [])

  async function togglePush() {
    setBusy(true)
    setMessage(undefined)
    try {
      if (push === 'on') {
        await disablePush()
        setPush('off')
      } else {
        setPush(await enablePush())
      }
    } catch {
      setMessage(m.pushFailed())
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setMessage(undefined)
    try {
      const { sent } = await sendTestNotification()
      setMessage(sent > 0 ? m.pushTestSent() : m.pushTestNone())
    } catch {
      setMessage(m.pushFailed())
    }
  }

  async function save(baby: Baby, kind: ReminderKind, minutes: number) {
    const previous = reminders.get(keyOf(baby.id, kind))
    const next: Reminder = {
      babyId: baby.id,
      kind,
      intervalMinutes: minutes || previous?.intervalMinutes || DEFAULT_MINUTES[kind],
      enabled: minutes > 0,
    }
    const update = (reminder: Reminder | undefined) =>
      setReminders((map) => {
        const copy = new Map(map)
        if (reminder) copy.set(keyOf(baby.id, kind), reminder)
        else copy.delete(keyOf(baby.id, kind))
        return copy
      })
    update(next)
    setMessage(undefined)
    try {
      await reminderApi.save(next)
    } catch {
      update(previous)
      setMessage(m.reminderSaveFailed())
    }
  }

  const hint = push ? pushHint[push] : undefined

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-title font-extrabold">{m.remindersTitle()}</h2>
      <p className="m-0 text-fg-muted">{m.remindersIntro()}</p>

      {hint ? (
        <p className="m-0 font-bold">{hint()}</p>
      ) : (
        push && (
          <div className="flex flex-col gap-2">
            <p className="m-0 font-bold">{push === 'on' ? m.pushOn() : m.pushOff()}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={push === 'on' ? 'outline' : 'solid'}
                disabled={busy}
                onClick={() => void togglePush()}
              >
                {push === 'on' ? m.pushDisable() : m.pushEnable()}
              </Button>
              {push === 'on' && (
                <Button variant="ghost" onClick={() => void test()}>
                  {m.pushTest()}
                </Button>
              )}
            </div>
          </div>
        )
      )}

      {babies.map((baby) => (
        <section key={baby.id} className="flex flex-col gap-3 border-t-2 border-border pt-3">
          <h3 className="m-0 font-extrabold">{baby.name}</h3>
          {(['feeding', 'diaper'] as const).map((kind) => {
            const reminder = reminders.get(keyOf(baby.id, kind))
            const value = reminder?.enabled ? reminder.intervalMinutes : 0
            const choices = CHOICES[kind].includes(value)
              ? CHOICES[kind]
              : [...CHOICES[kind], value]
            return (
              <div key={kind} className="flex flex-col gap-2">
                <span className="text-caption font-bold text-fg-muted">
                  {m.reminderRow({ kind: KIND_LABEL[kind]() })}
                </span>
                <SegmentedControl<string>
                  label={`${baby.name} ${KIND_LABEL[kind]()}`}
                  options={choices.map((minutes) => ({
                    value: String(minutes),
                    label:
                      minutes === 0
                        ? m.reminderOff()
                        : m.reminderHours({ hours: formatNumber(minutes / 60) }),
                  }))}
                  value={String(value)}
                  onChange={(minutes) => void save(baby, kind, Number(minutes))}
                />
              </div>
            )
          })}
        </section>
      ))}

      {message && <output className="m-0 font-bold">{message}</output>}
    </Card>
  )
}

import type { Baby, Reminder, ReminderKind } from '@bobo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

const REMINDERS_KEY = ['reminders']
const PUSH_STATE_KEY = ['push-state']

const sameReminder = (a: Reminder, b: Pick<Reminder, 'babyId' | 'kind'>) =>
  a.babyId === b.babyId && a.kind === b.kind

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
  const queryClient = useQueryClient()
  const { data: push } = useQuery({ queryKey: PUSH_STATE_KEY, queryFn: getPushState })
  const { data: reminders = [] } = useQuery({ queryKey: REMINDERS_KEY, queryFn: reminderApi.list })
  const [message, setMessage] = useState<string>()

  // Browsers may rotate subscriptions, and the device may have changed hands since.
  useEffect(() => {
    void refreshPushSubscription().catch(() => undefined)
  }, [])

  const togglePush = useMutation({
    mutationFn: async (): Promise<PushState> => {
      if (push !== 'on') return enablePush()
      await disablePush()
      return 'off'
    },
    onMutate: () => setMessage(undefined),
    onSuccess: (state) => queryClient.setQueryData(PUSH_STATE_KEY, state),
    onError: () => setMessage(m.pushFailed()),
  })

  const test = useMutation({
    mutationFn: sendTestNotification,
    onMutate: () => setMessage(undefined),
    onSuccess: ({ sent }) => setMessage(sent > 0 ? m.pushTestSent() : m.pushTestNone()),
    onError: () => setMessage(m.pushFailed()),
  })

  // Optimistic: the choice shows at once and rolls back if the server refuses it.
  const save = useMutation({
    mutationFn: reminderApi.save,
    onMutate: async (next: Reminder) => {
      setMessage(undefined)
      await queryClient.cancelQueries({ queryKey: REMINDERS_KEY })
      const previous = queryClient.getQueryData<Reminder[]>(REMINDERS_KEY)
      queryClient.setQueryData<Reminder[]>(REMINDERS_KEY, (list = []) => [
        ...list.filter((item) => !sameReminder(item, next)),
        next,
      ])
      return { previous }
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(REMINDERS_KEY, context?.previous)
      setMessage(m.reminderSaveFailed())
    },
  })

  function choose(baby: Baby, kind: ReminderKind, minutes: number) {
    const previous = reminders.find((item) => sameReminder(item, { babyId: baby.id, kind }))
    save.mutate({
      babyId: baby.id,
      kind,
      intervalMinutes: minutes || previous?.intervalMinutes || DEFAULT_MINUTES[kind],
      enabled: minutes > 0,
    })
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
                disabled={togglePush.isPending}
                onClick={() => togglePush.mutate()}
              >
                {push === 'on' ? m.pushDisable() : m.pushEnable()}
              </Button>
              {push === 'on' && (
                <Button variant="ghost" disabled={test.isPending} onClick={() => test.mutate()}>
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
            const reminder = reminders.find((item) => sameReminder(item, { babyId: baby.id, kind }))
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
                  onChange={(minutes) => choose(baby, kind, Number(minutes))}
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

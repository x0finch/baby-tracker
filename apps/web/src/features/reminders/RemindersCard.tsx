import type { Baby, Reminder, ReminderKind } from '@bobo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { formatNumber } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useBabies } from '../babies/use-babies'
import { reminderKey, useReminders } from './collection'
import {
  type PushState,
  disablePush,
  enablePush,
  getPushState,
  refreshPushSubscription,
  sendTestNotification,
} from './notifications'

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

const PUSH_STATE_KEY = ['push-state']

const pushHint: Partial<Record<PushState, () => string>> = {
  unsupported: m.pushUnsupported,
  'needs-install': m.pushNeedsInstall,
  denied: m.pushDenied,
}

/** Whether this device can and does receive notifications. */
export const usePushState = () => useQuery({ queryKey: PUSH_STATE_KEY, queryFn: getPushState }).data

/** Device notifications and per-baby "it's been a while" reminders; signed-in users only. */
export function RemindersCard() {
  const { userId } = useAccess()
  if (!userId) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{m.remindersSignedOut()}</p>
      </Card>
    )
  }
  return <Reminders key={userId} userId={userId} />
}

function Reminders({ userId }: { userId: string }) {
  const { active } = useBabies()
  // Reminders run on the server, so only babies that have synced to a family can have them.
  const babies = active.filter((baby) => baby.familyId !== null)
  const queryClient = useQueryClient()
  const push = usePushState()
  const { collection } = useReminders(userId)
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

  function choose(baby: Baby, kind: ReminderKind, minutes: number) {
    setMessage(undefined)
    const key = reminderKey({ babyId: baby.id, kind })
    const previous = collection.get(key)
    const next: Reminder = {
      babyId: baby.id,
      kind,
      intervalMinutes: minutes || previous?.intervalMinutes || DEFAULT_MINUTES[kind],
      enabled: minutes > 0,
    }
    // Optimistic: the choice shows at once and rolls back if the server refuses it.
    const change = previous
      ? collection.update(key, (draft) => Object.assign(draft, next))
      : collection.insert(next)
    change.isPersisted.promise.catch(() => setMessage(m.reminderSaveFailed()))
  }

  const hint = push ? pushHint[push] : undefined

  return (
    <Card className="flex flex-col gap-4">
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
            const reminder = collection.get(reminderKey({ babyId: baby.id, kind }))
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

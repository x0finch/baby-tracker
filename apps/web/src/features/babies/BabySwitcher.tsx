import { localDateString } from '@bobo/shared'
import { clsx } from 'clsx'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { createBaby } from './actions'
import { ageLabel } from './age-label'
import { BabyAvatar } from './BabyAvatar'
import { BabyForm } from './BabyForm'
import { nextAvatarColor } from './records'
import { useBabies, useSelectedBaby } from './use-babies'

/** Top bar showing the selected baby; tapping it opens the baby picker. */
export function BabySwitcher() {
  const store = useLocalStore()
  const { active } = useBabies()
  const { baby, select } = useSelectedBaby()
  const [sheet, setSheet] = useState<'closed' | 'pick' | 'add'>('closed')
  const close = () => setSheet('closed')

  if (!baby) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet('pick')}
        aria-label={m.switcherLabel({ name: baby.name })}
        className="mb-4 flex min-h-touch w-full items-center gap-3 rounded-xl border-2 border-b-4 border-border px-3 py-2 text-left active:translate-y-0.5 active:border-b-2"
      >
        <BabyAvatar name={baby.name} color={baby.avatarColor} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-extrabold">{baby.name}</span>
          <span className="text-caption text-fg-muted">{ageLabel(baby.birthDate)}</span>
        </span>
        {active.length > 1 && (
          <svg aria-hidden viewBox="0 0 24 24" className="size-6 text-fg-muted">
            <path
              d="M7 9l5-5 5 5M7 15l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <Sheet open={sheet === 'pick'} onClose={close} title={m.switcherTitle()}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {active.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={option.id === baby.id}
                onClick={() => {
                  select(option.id)
                  close()
                }}
                className={clsx(
                  'flex min-h-touch w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left',
                  option.id === baby.id ? 'border-diaper bg-diaper-soft' : 'border-border',
                )}
              >
                <BabyAvatar name={option.name} color={option.avatarColor} />
                <span className="flex flex-col">
                  <span className="font-extrabold">{option.name}</span>
                  <span className="text-caption text-fg-muted">{ageLabel(option.birthDate)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="soft" tone="primary" block onClick={() => setSheet('add')}>
          {m.addBabyTitle()}
        </Button>
      </Sheet>

      <Sheet open={sheet === 'add'} onClose={close} title={m.addBabyTitle()}>
        {sheet === 'add' && (
          <BabyForm
            initial={{
              name: '',
              birthDate: localDateString(),
              sex: 'unspecified',
              avatarColor: nextAvatarColor(active),
            }}
            submitLabel={m.addBabyTitle()}
            onCancel={close}
            onSubmit={(input) => {
              createBaby(store, input)
              close()
            }}
          />
        )}
      </Sheet>
    </>
  )
}

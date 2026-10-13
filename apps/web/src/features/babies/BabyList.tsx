import type { Baby } from '@bobo/shared'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { setBabyArchived, updateBaby } from './actions'
import { ageLabel } from './age-label'
import { BabyAvatar } from './BabyAvatar'
import { BabyForm } from './BabyForm'
import { useBabies } from './use-babies'

function BabyRow({ baby, onClick }: { baby: Baby; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-touch w-full items-center gap-3 rounded-lg py-1 text-left active:bg-surface"
    >
      <BabyAvatar name={baby.name} color={baby.avatarColor} />
      <span className="flex flex-col">
        <span className="font-extrabold">{baby.name}</span>
        <span className="text-caption text-fg-muted">{ageLabel(baby.birthDate)}</span>
      </span>
    </button>
  )
}

/** Baby management in settings: edit, archive and restore. */
export function BabyList() {
  const store = useLocalStore()
  const { active, archived } = useBabies()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = [...active, ...archived].find((baby) => baby.id === editingId)
  const close = () => setEditingId(null)

  return (
    <div className="flex flex-col gap-2">
      {active.length === 0 && <p className="text-fg-muted">{m.babyListEmpty()}</p>}
      {active.map((baby) => (
        <BabyRow key={baby.id} baby={baby} onClick={() => setEditingId(baby.id)} />
      ))}
      {archived.length > 0 && (
        <>
          <h3 className="mt-2 text-caption font-bold text-fg-muted">{m.archivedBabies()}</h3>
          {archived.map((baby) => (
            <div key={baby.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1 opacity-70">
                <BabyRow baby={baby} onClick={() => setEditingId(baby.id)} />
              </div>
              <Button
                variant="ghost"
                tone="diaper"
                onClick={() => setBabyArchived(store, baby.id, false)}
              >
                {m.babyRestore()}
              </Button>
            </div>
          ))}
        </>
      )}

      <Sheet open={editing !== undefined} onClose={close} title={m.editBabyTitle()}>
        {editing && (
          <>
            <BabyForm
              key={editing.id}
              initial={editing}
              submitLabel={m.actionSave()}
              onCancel={close}
              onSubmit={(input) => {
                updateBaby(store, editing.id, input)
                close()
              }}
            />
            {editing.archivedAt === null && (
              <div className="flex flex-col gap-1 border-t-2 border-border pt-4">
                <Button
                  variant="ghost"
                  tone="danger"
                  onClick={() => {
                    setBabyArchived(store, editing.id, true)
                    close()
                  }}
                >
                  {m.babyArchive()}
                </Button>
                <p className="text-center text-caption text-fg-muted">{m.babyArchiveHint()}</p>
              </div>
            )}
          </>
        )}
      </Sheet>
    </div>
  )
}

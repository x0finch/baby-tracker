import type { Baby } from '@bobo/shared'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { deleteBaby } from './actions'

/**
 * Deleting a baby removes it and every record for the whole family. The sheet says so and,
 * when there are records, asks for the baby's name before the button works.
 */
export function DeleteBabySheet({
  baby,
  onClose,
}: {
  baby: Baby | undefined
  onClose: () => void
}) {
  return (
    <Sheet open={baby !== undefined} onClose={onClose} title={m.babyDelete()}>
      {baby && <DeleteBabyContent key={baby.id} baby={baby} onDone={onClose} />}
    </Sheet>
  )
}

function DeleteBabyContent({ baby, onDone }: { baby: Baby; onDone: () => void }) {
  const store = useLocalStore()
  const { access } = useAccess()
  const [typed, setTyped] = useState('')
  const records = store.events.toArray.filter(
    (event) => event.babyId === baby.id && event.deletedAt === null,
  ).length
  const family = access?.find((item) => item.id === baby.familyId)
  const others = (family?.memberCount ?? 1) - 1
  const confirmed = records === 0 || typed.trim() === baby.name

  return (
    <>
      {records === 0 ? (
        <p>{m.babyDeleteEmpty({ name: baby.name })}</p>
      ) : (
        <>
          <p className="font-bold">{m.babyDeleteLead({ name: baby.name })}</p>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            <li>{m.babyDeleteRecords({ count: records })}</li>
            {others > 0 && <li>{m.babyDeleteShared({ count: others })}</li>}
          </ul>
          <p className="text-fg-muted">{m.babyDeleteArchiveHint()}</p>
          <Input
            label={m.babyDeleteTypeName({ name: baby.name })}
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </>
      )}
      <Button
        tone="danger"
        size="lg"
        block
        disabled={!confirmed}
        onClick={() => {
          deleteBaby(store, baby.id)
          onDone()
        }}
      >
        {m.familyDeleteConfirm()}
      </Button>
      <Button variant="outline" block onClick={onDone}>
        {m.actionCancel()}
      </Button>
    </>
  )
}

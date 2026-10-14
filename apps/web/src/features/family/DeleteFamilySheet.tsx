import { type FamilySummary, familyDisplayName } from '@bobo/shared'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { requestSync } from '../../sync/runner'
import { familyApi } from './api'

/**
 * Deleting a family removes its babies and records for everyone. The sheet spells that out
 * and, unless the family is empty, asks for its name before the button works.
 */
export function DeleteFamilySheet({
  family,
  babies,
  records,
  members,
  open,
  onClose,
}: {
  family: FamilySummary
  babies: number
  records: number
  /** Members other than the owner. */
  members: number
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const empty = babies === 0 && members === 0
  const confirmed = empty || typed.trim() === family.name
  const remove = useMutation({
    mutationFn: () => familyApi.remove(family.id),
    onSuccess: async () => {
      onClose()
      await navigate({ to: '/settings' })
      // The next pull no longer lists the family, which removes its data from this device.
      await requestSync()
    },
  })

  return (
    <Sheet open={open} onClose={onClose} title={m.familyDelete()}>
      {empty ? (
        <p>{m.familyDeleteEmpty({ name: familyDisplayName(family) })}</p>
      ) : (
        <>
          <p className="font-bold">{m.familyDeleteLead({ name: family.name })}</p>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            <li>{m.familyDeleteRecords({ babies, records })}</li>
            {members > 0 && <li>{m.familyDeleteMembers({ count: members })}</li>}
            <li>{m.familyDeleteInvites()}</li>
          </ul>
          {members > 0 && <p className="text-fg-muted">{m.familyDeleteTransferHint()}</p>}
          <Input
            label={m.familyDeleteTypeName({ name: family.name })}
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
        disabled={!confirmed || remove.isPending}
        onClick={() => remove.mutate()}
      >
        {m.familyDeleteConfirm()}
      </Button>
      <Button variant="outline" block onClick={onClose}>
        {m.actionCancel()}
      </Button>
      {remove.isError && <FormError>{m.actionFailed()}</FormError>}
    </Sheet>
  )
}

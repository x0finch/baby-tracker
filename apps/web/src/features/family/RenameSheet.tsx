import type { FamilySummary } from '@bobo/shared'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { requestSync } from '../../sync/runner'
import { familyApi } from './api'

export function RenameSheet({
  family,
  open,
  onClose,
}: {
  family: FamilySummary
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(family.name)
  const rename = useMutation({
    mutationFn: (next: string) => familyApi.rename(family.id, next),
    onSuccess: async () => {
      onClose()
      // The new name arrives with the next pull's access list.
      await requestSync()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed) rename.mutate(trimmed)
  }

  return (
    <Sheet open={open} onClose={onClose} title={m.familyRename()}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={m.familyNameLabel()}
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="lg" block disabled={!name.trim() || rename.isPending}>
          {m.actionSave()}
        </Button>
        {rename.isError && <FormError>{m.actionFailed()}</FormError>}
      </form>
    </Sheet>
  )
}

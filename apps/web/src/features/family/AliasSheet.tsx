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

/** A member's private name for a family; only they see it. */
export function AliasSheet({
  family,
  open,
  onClose,
}: {
  family: FamilySummary
  open: boolean
  onClose: () => void
}) {
  const [alias, setAlias] = useState(family.alias ?? '')
  const save = useMutation({
    mutationFn: () => familyApi.setAlias(family.id, alias.trim()),
    onSuccess: async () => {
      onClose()
      // The alias arrives with the next pull's access list.
      await requestSync()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Sheet open={open} onClose={onClose} title={m.familyAlias()}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={m.familyAliasLabel()}
          hint={m.familyAliasHint({ name: family.name })}
          value={alias}
          maxLength={40}
          onChange={(e) => setAlias(e.target.value)}
        />
        <Button type="submit" size="lg" block disabled={save.isPending}>
          {m.actionSave()}
        </Button>
        {save.isError && <FormError>{m.actionFailed()}</FormError>}
      </form>
    </Sheet>
  )
}

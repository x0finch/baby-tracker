import {
  type Baby,
  type FamilyMember,
  type FamilySummary,
  type MemberRole,
  assignableRoles,
} from '@bobo/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { familyApi } from './api'
import { BabyScopePicker } from './BabyScopePicker'
import { RolePicker } from './RolePicker'

export function MemberSheet({
  family,
  member,
  babies,
  onClose,
  onChanged,
}: {
  family: FamilySummary
  member: FamilyMember | undefined
  babies: Baby[]
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <Sheet open={member !== undefined} onClose={onClose} title={member?.name ?? m.memberTitle()}>
      {member && member.role !== 'owner' && (
        <MemberForm
          key={member.userId}
          family={family}
          member={{ ...member, role: member.role }}
          babies={babies}
          onDone={() => {
            onChanged()
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

function MemberForm({
  family,
  member,
  babies,
  onDone,
}: {
  family: FamilySummary
  member: FamilyMember & { role: MemberRole }
  babies: Baby[]
  onDone: () => void
}) {
  const [role, setRole] = useState<MemberRole>(member.role)
  const [babyIds, setBabyIds] = useState<string[] | null>(member.babyIds)
  const change = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: onDone,
  })

  return (
    <div className="flex flex-col gap-4">
      <RolePicker roles={assignableRoles(family.role)} value={role} onChange={setRole} />
      {babies.length > 1 && (
        <BabyScopePicker babies={babies} value={babyIds} onChange={setBabyIds} />
      )}
      <Button
        size="lg"
        block
        disabled={babyIds?.length === 0 || change.isPending}
        onClick={() =>
          change.mutate(() => familyApi.updateMember(family.id, member.userId, { role, babyIds }))
        }
      >
        {m.memberSave()}
      </Button>
      <Button
        variant="ghost"
        tone="danger"
        disabled={change.isPending}
        onClick={() => change.mutate(() => familyApi.removeMember(family.id, member.userId))}
      >
        {m.memberRemove()}
      </Button>
      {change.isError && <FormError>{m.actionFailed()}</FormError>}
    </div>
  )
}

import { type FamilySummary, canManageMember, isManager } from '@bobo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmSheet } from '../../components/ui/ConfirmSheet'
import { FormError } from '../../components/ui/FormError'
import { m } from '../../paraglide/messages.js'
import { requestSync } from '../../sync/runner'
import { useAccess } from '../../sync/use-access'
import { useBabies } from '../babies/use-babies'
import { familyApi, invitesQuery, useMembers } from './api'
import { scopeLabel } from './BabyScopePicker'
import { InviteSheet } from './InviteSheet'
import { MemberSheet } from './MemberSheet'
import { RenameSheet } from './RenameSheet'
import { roleLabel } from './roles'

function FamilyCard({ family, userId }: { family: FamilySummary; userId: string | undefined }) {
  const { active, archived } = useBabies()
  const babies = [...active, ...archived].filter((baby) => baby.familyId === family.id)
  const queryClient = useQueryClient()
  const members = useMembers(family.id)
  const managing = isManager(family.role)
  const { data: invites = [] } = useQuery({ ...invitesQuery(family.id), enabled: managing })
  const [sheet, setSheet] = useState<'invite' | 'rename' | 'leave' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = members?.find((member) => member.userId === editingId)
  // Members and invites both change after inviting, editing or revoking.
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['family', family.id] })

  const leave = useMutation({
    mutationFn: async () => {
      if (userId) await familyApi.removeMember(family.id, userId)
    },
    onSuccess: async () => {
      setSheet(null)
      // The next pull no longer lists the family, which removes its data from this device.
      await requestSync()
    },
  })
  const revoke = useMutation({
    mutationFn: (code: string) => familyApi.revokeInvite(family.id, code),
    onSuccess: refresh,
  })

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-title font-extrabold">{family.name}</h2>
        <span className="rounded-full bg-surface px-2 text-caption font-bold text-fg-muted">
          {roleLabel[family.role]()}
        </span>
      </div>
      <h3 className="m-0 text-caption font-bold text-fg-muted">{m.familyTitle()}</h3>
      {members === undefined ? (
        <p className="m-0 text-fg-muted">{m.familyLoadFailed()}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {members.map((member) => {
            const editable = member.userId !== userId && canManageMember(family.role, member.role)
            return (
              <li key={member.userId}>
                <button
                  type="button"
                  disabled={!editable}
                  aria-label={`${member.name} ${roleLabel[member.role]()}`}
                  onClick={() => setEditingId(member.userId)}
                  className="flex min-h-touch w-full items-center gap-3 rounded-lg py-1 text-left active:bg-surface"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-extrabold">
                      {member.userId === userId
                        ? `${member.name}（${m.familyMemberYou()}）`
                        : member.name}
                    </span>
                    <span className="truncate text-caption text-fg-muted">
                      {`${roleLabel[member.role]()} · ${scopeLabel(member.babyIds, babies)}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {managing && invites.length > 0 && (
        <>
          <h3 className="m-0 text-caption font-bold text-fg-muted">{m.invitesPending()}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {invites.map((invite) => (
              <li key={invite.code} className="flex min-h-touch items-center gap-3">
                <span className="min-w-0 flex-1 truncate">
                  {`${roleLabel[invite.role]()} · ${scopeLabel(invite.babyIds, babies)}`}
                </span>
                <Button
                  variant="ghost"
                  tone="danger"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(invite.code)}
                >
                  {m.inviteRevoke()}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        {managing && (
          <Button variant="soft" tone="diaper" onClick={() => setSheet('invite')}>
            {m.familyInvite()}
          </Button>
        )}
        {managing && (
          <Button variant="outline" onClick={() => setSheet('rename')}>
            {m.familyRename()}
          </Button>
        )}
      </div>
      {family.role !== 'owner' && (
        <Button variant="ghost" tone="danger" onClick={() => setSheet('leave')}>
          {m.familyLeave()}
        </Button>
      )}
      {(leave.isError || revoke.isError) && <FormError>{m.actionFailed()}</FormError>}

      <InviteSheet
        family={family}
        babies={babies}
        open={sheet === 'invite'}
        onClose={() => setSheet(null)}
        onCreated={refresh}
      />
      <RenameSheet
        key={family.name}
        family={family}
        open={sheet === 'rename'}
        onClose={() => setSheet(null)}
      />
      <MemberSheet
        family={family}
        member={editing}
        babies={babies}
        onClose={() => setEditingId(null)}
        onChanged={refresh}
      />
      <ConfirmSheet
        open={sheet === 'leave'}
        onClose={() => setSheet(null)}
        title={m.familyLeave()}
        confirmLabel={m.familyLeaveConfirm()}
        onConfirm={() => leave.mutate()}
        busy={leave.isPending}
      >
        {m.familyLeaveBody({ name: family.name })}
      </ConfirmSheet>
    </Card>
  )
}

/** One card per family the signed-in user belongs to. */
export function FamilySection() {
  const { access, userId } = useAccess()
  if (!userId || !access) return null
  return (
    <>
      {access.map((family) => (
        <FamilyCard key={family.id} family={family} userId={userId} />
      ))}
    </>
  )
}

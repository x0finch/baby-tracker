import type { Baby, FamilyMember, FamilyRole, FamilySummary, Invite } from '@bobo/shared'
import { clsx } from 'clsx'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { requestSync } from '../../sync/runner'
import { useAccess } from '../../sync/use-access'
import { BabyAvatar } from '../babies/BabyAvatar'
import { useBabies } from '../babies/use-babies'
import { familyApi, inviteUrl, useMembers } from './api'

type MemberRole = Exclude<FamilyRole, 'owner'>

export const roleLabel: Record<FamilyRole, () => string> = {
  owner: m.roleOwner,
  admin: m.roleAdmin,
  caregiver: m.roleCaregiver,
  viewer: m.roleViewer,
}

const roleHint: Record<MemberRole, () => string> = {
  admin: m.roleAdminHint,
  caregiver: m.roleCaregiverHint,
  viewer: m.roleViewerHint,
}

/** Mirrors the server rule: owners manage everyone else, admins manage non-admins. */
function canManage(actor: FamilyRole, target: FamilyRole): boolean {
  if (target === 'owner') return false
  if (actor === 'owner') return true
  return actor === 'admin' && target !== 'admin'
}

function assignableRoles(actor: FamilyRole): MemberRole[] {
  return actor === 'owner' ? ['admin', 'caregiver', 'viewer'] : ['caregiver', 'viewer']
}

function RolePicker({
  roles,
  value,
  onChange,
}: {
  roles: MemberRole[]
  value: MemberRole
  onChange: (role: MemberRole) => void
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 font-bold">{m.inviteRoleLabel()}</legend>
      {roles.map((role) => (
        <label
          key={role}
          className={clsx(
            'flex min-h-touch cursor-pointer flex-col rounded-xl border-2 px-3 py-2',
            value === role ? 'border-diaper bg-diaper-soft' : 'border-border',
          )}
        >
          <input
            type="radio"
            className="sr-only"
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span className="font-extrabold">{roleLabel[role]()}</span>
          <span className="text-caption text-fg-muted">{roleHint[role]()}</span>
        </label>
      ))}
    </fieldset>
  )
}

function BabyScopePicker({
  babies,
  value,
  onChange,
}: {
  babies: Baby[]
  value: string[] | null
  onChange: (value: string[] | null) => void
}) {
  const toggle = (id: string) => {
    const current = value ?? []
    onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 font-bold">{m.inviteBabiesLabel()}</legend>
      <label className="flex min-h-touch items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-diaper"
          checked={value === null}
          onChange={(e) => onChange(e.target.checked ? null : babies.map((baby) => baby.id))}
        />
        <span className="font-bold">{m.familyAllBabies()}</span>
      </label>
      {value !== null &&
        babies.map((baby) => (
          <label key={baby.id} className="flex min-h-touch items-center gap-3 pl-8">
            <input
              type="checkbox"
              className="size-5 accent-diaper"
              checked={value.includes(baby.id)}
              onChange={() => toggle(baby.id)}
            />
            <BabyAvatar name={baby.name} color={baby.avatarColor} />
            <span>{baby.name}</span>
          </label>
        ))}
    </fieldset>
  )
}

function scopeLabel(babyIds: string[] | null, babies: Baby[]): string {
  if (babyIds === null) return m.familyAllBabies()
  return babies
    .filter((baby) => babyIds.includes(baby.id))
    .map((baby) => baby.name)
    .join('、')
}

function InviteSheet({
  family,
  babies,
  open,
  onClose,
  onCreated,
}: {
  family: FamilySummary
  babies: Baby[]
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={m.familyInvite()}>
      {/* Mounted only while open, so every invite starts from a fresh form. */}
      {open && <InviteContent family={family} babies={babies} onCreated={onCreated} />}
    </Sheet>
  )
}

function InviteContent({
  family,
  babies,
  onCreated,
}: {
  family: FamilySummary
  babies: Baby[]
  onCreated: () => void
}) {
  const [role, setRole] = useState<MemberRole>('caregiver')
  const [babyIds, setBabyIds] = useState<string[] | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  async function create() {
    setFailed(false)
    try {
      setInvite(await familyApi.createInvite(family.id, { role, babyIds }))
      onCreated()
    } catch {
      setFailed(true)
    }
  }

  const url = invite ? inviteUrl(invite.code) : ''
  async function share() {
    try {
      await navigator.share({ title: m.joinTitle(), text: m.inviteShareText(), url })
    } catch {
      // Dismissed, or sharing is unavailable.
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return invite ? (
    <div className="flex flex-col gap-3">
      <p className="m-0 font-bold">{m.inviteLinkTitle()}</p>
      <p className="m-0 rounded-lg border-2 border-border bg-surface p-3 text-caption break-all select-all">
        {url}
      </p>
      <p className="m-0 text-caption text-fg-muted">{m.inviteLinkHint()}</p>
      {'share' in navigator && (
        <Button size="lg" block onClick={() => void share()}>
          {m.inviteShare()}
        </Button>
      )}
      <Button variant="outline" block onClick={() => void copy()}>
        {copied ? m.inviteCopied() : m.inviteCopy()}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <RolePicker roles={assignableRoles(family.role)} value={role} onChange={setRole} />
      {babies.length > 1 && (
        <BabyScopePicker babies={babies} value={babyIds} onChange={setBabyIds} />
      )}
      <Button size="lg" block disabled={babyIds?.length === 0} onClick={() => void create()}>
        {m.inviteCreate()}
      </Button>
      {failed && <p className="m-0 font-bold text-danger-text">{m.actionFailed()}</p>}
    </div>
  )
}

function MemberSheet({
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
  const [failed, setFailed] = useState(false)

  async function run(action: () => Promise<void>) {
    setFailed(false)
    try {
      await action()
      onDone()
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RolePicker roles={assignableRoles(family.role)} value={role} onChange={setRole} />
      {babies.length > 1 && (
        <BabyScopePicker babies={babies} value={babyIds} onChange={setBabyIds} />
      )}
      <Button
        size="lg"
        block
        disabled={babyIds?.length === 0}
        onClick={() =>
          void run(() => familyApi.updateMember(family.id, member.userId, { role, babyIds }))
        }
      >
        {m.memberSave()}
      </Button>
      <Button
        variant="ghost"
        tone="danger"
        onClick={() => void run(() => familyApi.removeMember(family.id, member.userId))}
      >
        {m.memberRemove()}
      </Button>
      {failed && <p className="m-0 font-bold text-danger-text">{m.actionFailed()}</p>}
    </div>
  )
}

function RenameSheet({
  family,
  open,
  onClose,
}: {
  family: FamilySummary
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(family.name)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await familyApi.rename(family.id, trimmed)
      onClose()
      // The new name arrives with the next pull's access list.
      await requestSync()
    } catch {
      setFailed(true)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={m.familyRename()}>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Input
          label={m.familyNameLabel()}
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="lg" block disabled={!name.trim()}>
          {m.actionSave()}
        </Button>
        {failed && <p className="m-0 font-bold text-danger-text">{m.actionFailed()}</p>}
      </form>
    </Sheet>
  )
}

function FamilyCard({ family, userId }: { family: FamilySummary; userId: string | undefined }) {
  const { active, archived } = useBabies()
  const babies = [...active, ...archived].filter((baby) => baby.familyId === family.id)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const members = useMembers(family.id, version)
  const managing = family.role === 'owner' || family.role === 'admin'
  const [invites, setInvites] = useState<Invite[]>([])
  const [sheet, setSheet] = useState<'invite' | 'rename' | 'leave' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const editing = members?.find((member) => member.userId === editingId)

  useEffect(() => {
    if (!managing) return undefined
    let current = true
    familyApi.invites(family.id).then(
      (list) => current && setInvites(list),
      () => undefined,
    )
    return () => {
      current = false
    }
    // `version` re-fetches after invites are created or revoked.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [family.id, managing, version])

  async function leave() {
    setFailed(false)
    try {
      if (userId) await familyApi.removeMember(family.id, userId)
      setSheet(null)
      // The next pull no longer lists the family, which removes its data from this device.
      await requestSync()
    } catch {
      setFailed(true)
    }
  }

  async function revoke(code: string) {
    try {
      await familyApi.revokeInvite(family.id, code)
      refresh()
    } catch {
      setFailed(true)
    }
  }

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
            const editable = member.userId !== userId && canManage(family.role, member.role)
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
                <Button variant="ghost" tone="danger" onClick={() => void revoke(invite.code)}>
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
      {failed && <p className="m-0 font-bold text-danger-text">{m.actionFailed()}</p>}

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
      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title={m.familyLeave()}>
        <p className="m-0">{m.familyLeaveBody({ name: family.name })}</p>
        <Button tone="danger" size="lg" block onClick={() => void leave()}>
          {m.familyLeaveConfirm()}
        </Button>
        <Button variant="outline" block onClick={() => setSheet(null)}>
          {m.actionCancel()}
        </Button>
      </Sheet>
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

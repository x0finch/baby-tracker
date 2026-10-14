import type { FamilyRole } from '@bobo/shared'

import { m } from '../../paraglide/messages.js'

export type MemberRole = Exclude<FamilyRole, 'owner'>

export const roleLabel: Record<FamilyRole, () => string> = {
  owner: m.roleOwner,
  admin: m.roleAdmin,
  caregiver: m.roleCaregiver,
  viewer: m.roleViewer,
}

export const roleHint: Record<MemberRole, () => string> = {
  admin: m.roleAdminHint,
  caregiver: m.roleCaregiverHint,
  viewer: m.roleViewerHint,
}

/** Mirrors the server rule: owners manage everyone else, admins manage non-admins. */
export function canManage(actor: FamilyRole, target: FamilyRole): boolean {
  if (target === 'owner') return false
  if (actor === 'owner') return true
  return actor === 'admin' && target !== 'admin'
}

export function assignableRoles(actor: FamilyRole): MemberRole[] {
  return actor === 'owner' ? ['admin', 'caregiver', 'viewer'] : ['caregiver', 'viewer']
}

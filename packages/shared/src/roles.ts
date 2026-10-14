import type { FamilyRole } from './sync'

/** Roles a member can be given; ownership only changes hands through a transfer. */
export type MemberRole = Exclude<FamilyRole, 'owner'>

/** Owners and admins manage babies, members and invites. */
export const isManager = (role: FamilyRole): boolean => role === 'owner' || role === 'admin'

/**
 * Whether `actor` may change or remove a member currently holding `target`, optionally giving
 * them `next`. Owners manage everyone but themselves; admins manage caregivers and viewers.
 */
export function canManageMember(actor: FamilyRole, target: FamilyRole, next?: MemberRole): boolean {
  if (target === 'owner') return false
  if (actor === 'owner') return true
  if (actor !== 'admin') return false
  return target !== 'admin' && next !== 'admin'
}

/** Roles `actor` can hand out when inviting or editing a member. */
export function assignableRoles(actor: FamilyRole): MemberRole[] {
  if (actor === 'owner') return ['admin', 'caregiver', 'viewer']
  return actor === 'admin' ? ['caregiver', 'viewer'] : []
}

/** Whether a baby is within a member's scope; `null` means every baby of the family. */
export function inBabyScope(
  babyIds: ReadonlySet<string> | readonly string[] | null,
  babyId: string,
): boolean {
  if (babyIds === null) return true
  return 'has' in babyIds ? babyIds.has(babyId) : babyIds.includes(babyId)
}

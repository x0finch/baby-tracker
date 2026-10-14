import type { FamilyRole } from '@bobo/shared'

/**
 * Whether `actor` may change or remove a member currently holding `target`, optionally giving
 * them `next`. Owners manage everyone but themselves; admins manage caregivers and viewers.
 * The owner role only changes hands through an explicit transfer.
 */
export function canManageMember(
  actor: FamilyRole,
  target: FamilyRole,
  next?: Exclude<FamilyRole, 'owner'>,
): boolean {
  if (target === 'owner') return false
  if (actor === 'owner') return true
  if (actor !== 'admin') return false
  return target !== 'admin' && next !== 'admin'
}

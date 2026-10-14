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

/** The user's role in the family, or null when they are not a member. */
export async function roleOf(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<FamilyRole | null> {
  const row = await db
    .prepare('select role from memberships where family_id = ? and user_id = ?')
    .bind(familyId, userId)
    .first<{ role: FamilyRole }>()
  return row?.role ?? null
}

/** Whether every id names a baby of the family (duplicates allowed). */
export async function babiesInFamily(
  db: D1Database,
  familyId: string,
  babyIds: readonly string[],
): Promise<boolean> {
  const row = await db
    .prepare(
      'select count(*) as n from babies where family_id = ? and id in (select value from json_each(?))',
    )
    .bind(familyId, JSON.stringify(babyIds))
    .first<{ n: number }>()
  return row?.n === new Set(babyIds).size
}

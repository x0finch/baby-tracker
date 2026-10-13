import type { FamilyRole } from '@bobo/shared'

/** Roles that may create and change records (Phase 3 narrows caregivers to their own). */
export const WRITE_ROLES: readonly FamilyRole[] = ['owner', 'admin', 'caregiver']

export async function getMemberships(
  db: D1Database,
  userId: string,
): Promise<{ familyId: string; role: FamilyRole }[]> {
  const { results } = await db
    .prepare('select family_id as familyId, role from memberships where user_id = ?')
    .bind(userId)
    .all<{ familyId: string; role: FamilyRole }>()
  return results
}

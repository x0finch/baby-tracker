import type { Baby, Event, FamilyRole, FamilySummary, PushRejectReason } from '@bobo/shared'

export interface FamilyAccess {
  id: string
  name: string
  role: FamilyRole
  /** null: every baby of the family. */
  babyIds: ReadonlySet<string> | null
}

export type Access = ReadonlyMap<string, FamilyAccess>

interface AccessRow {
  id: string
  name: string
  role: FamilyRole
  babyScope: 'all' | 'selected'
  babyIds: string
}

/** Parses a JSON array of strings from SQLite (e.g. `json_group_array`), skipping non-strings. */
export function parseStringList(json: string): string[] {
  const value: unknown = JSON.parse(json)
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

/** Everything the user can access, in one query. */
export async function loadAccess(db: D1Database, userId: string): Promise<Access> {
  const { results } = await db
    .prepare(
      `select f.id, f.name, m.role, m.baby_scope as babyScope,
         (select json_group_array(mb.baby_id) from membership_babies mb
          where mb.family_id = m.family_id and mb.user_id = m.user_id) as babyIds
       from memberships m join families f on f.id = m.family_id
       where m.user_id = ? order by m.created_at`,
    )
    .bind(userId)
    .all<AccessRow>()
  return new Map(
    results.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        role: row.role,
        babyIds: row.babyScope === 'all' ? null : new Set(parseStringList(row.babyIds)),
      },
    ]),
  )
}

export function toSummaries(access: Access): FamilySummary[] {
  return [...access.values()].map((family) => ({
    id: family.id,
    name: family.name,
    role: family.role,
    babyIds: family.babyIds ? [...family.babyIds] : null,
  }))
}

/** Read filters for pull: whole families, plus individual babies in scoped families. */
export function readScope(access: Access): { familyIds: string[]; babyIds: string[] } {
  const familyIds: string[] = []
  const babyIds: string[] = []
  for (const family of access.values()) {
    if (family.babyIds === null) familyIds.push(family.id)
    else babyIds.push(...family.babyIds)
  }
  return { familyIds, babyIds }
}

const canSee = (family: FamilyAccess, babyId: string) =>
  family.babyIds === null || family.babyIds.has(babyId)

export interface ExistingBaby {
  familyId: string | null
}

/** Babies are managed by owners and admins (within their baby scope). */
export function checkBabyWrite(
  access: Access,
  baby: Baby,
  existing: ExistingBaby | undefined,
): PushRejectReason | null {
  const family = baby.familyId ? access.get(baby.familyId) : undefined
  if (!family) return 'forbidden'
  if (existing && existing.familyId !== baby.familyId) return 'family_mismatch'
  if (family.role !== 'owner' && family.role !== 'admin') return 'forbidden'
  // Scoped admins can edit their babies but not add new ones.
  if (!canSee(family, baby.id)) return 'forbidden'
  return null
}

export interface ExistingEvent {
  familyId: string | null
  babyId: string
  createdBy: string | null
}

/**
 * Viewers cannot write; caregivers create events and change only their own; everyone is
 * limited to the babies in their scope (including the baby an event currently belongs to).
 */
export function checkEventWrite(
  access: Access,
  event: Event,
  existing: ExistingEvent | undefined,
  userId: string,
): PushRejectReason | null {
  const family = event.familyId ? access.get(event.familyId) : undefined
  if (!family) return 'forbidden'
  if (existing && existing.familyId !== event.familyId) return 'family_mismatch'
  if (family.role === 'viewer') return 'forbidden'
  if (!canSee(family, event.babyId)) return 'forbidden'
  if (existing && !canSee(family, existing.babyId)) return 'forbidden'
  if (family.role === 'caregiver' && existing && existing.createdBy !== userId) return 'forbidden'
  return null
}

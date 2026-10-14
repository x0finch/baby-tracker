import { type Baby, type FamilySummary, familyDisplayName } from '@bobo/shared'
import { Link } from '@tanstack/react-router'

import { Card } from '../../components/ui/Card'
import { Chevron } from '../../components/ui/Chevron'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { useBabies } from '../babies/use-babies'
import { roleLabel } from './roles'

/** Families the user created first, then the rest in the order they joined. */
export const sortFamilies = (access: readonly FamilySummary[]) =>
  access.toSorted((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'))

/** A couple of names read better than a count; more than that becomes "3 个宝宝". */
function babiesLabel(babies: readonly Baby[]): string {
  return babies.length > 0 && babies.length <= 2
    ? babies.map((baby) => baby.name).join('、')
    : m.familyBabiesCount({ count: babies.length })
}

/** Settings entry for families: one compact row each, opening the family's own page. */
export function FamilyList() {
  const { access, userId } = useAccess()
  const { active } = useBabies()
  if (!userId || !access || access.length === 0) return null

  return (
    <Card className="flex flex-col gap-1">
      <h2 className="mb-1 text-title font-extrabold">{m.familiesTitle()}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {sortFamilies(access).map((family) => {
          const babies = active.filter((baby) => baby.familyId === family.id)
          const details = [babiesLabel(babies)]
          if (family.memberCount) details.push(m.familyMembersCount({ count: family.memberCount }))
          return (
            <li key={family.id} className="border-b-2 border-border last:border-b-0">
              <Link
                to="/settings/family/$familyId"
                params={{ familyId: family.id }}
                className="flex min-h-touch items-center gap-3 py-3 active:bg-surface"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-extrabold">{familyDisplayName(family)}</span>
                    <span className="shrink-0 rounded-full bg-surface px-2 text-caption font-bold text-fg-muted">
                      {roleLabel[family.role]()}
                    </span>
                  </span>
                  <span className="truncate text-caption text-fg-muted">{details.join(' · ')}</span>
                </span>
                <Chevron />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

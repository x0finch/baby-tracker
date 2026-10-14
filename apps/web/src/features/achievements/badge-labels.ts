import { m } from '../../paraglide/messages.js'
import type { Badge } from './achievements'

export interface BadgeLabel {
  title: string
  description: string
  /** Short text inside the badge circle. */
  mark: string
}

const AGE: Record<string, () => string> = {
  'age-30': m.badgeAge30,
  'age-100': m.badgeAge100,
  'age-182': m.badgeAge182,
  'age-365': m.badgeAge365,
}
const AGE_MARK: Record<string, string> = {
  'age-30': '满月',
  'age-100': '百天',
  'age-182': '半岁',
  'age-365': '1岁',
}

export function badgeLabel(badge: Badge, babyName: string): BadgeLabel {
  const target = badge.progress?.target ?? 0
  switch (badge.group) {
    case 'records':
      return target === 1
        ? { title: m.badgeFirstRecord(), description: m.badgeFirstRecordDesc(), mark: '1' }
        : {
            title: m.badgeRecords({ count: target }),
            description: m.badgeRecordsDesc({ count: target }),
            mark: target >= 1000 ? `${target / 1000}k` : String(target),
          }
    case 'streak':
      return {
        title: m.badgeStreak({ days: target }),
        description: m.badgeStreakDesc({ days: target }),
        mark: String(target),
      }
    case 'night':
      return {
        title: target >= 100 ? m.badgeNight100() : m.badgeNight10(),
        description: m.badgeNightDesc({ count: target }),
        mark: '夜',
      }
    case 'firsts':
      return badge.id === 'first-solids'
        ? { title: m.badgeFirstSolids(), description: m.badgeFirstSolidsDesc(), mark: '辅' }
        : { title: m.badgeFirstGrowth(), description: m.badgeFirstGrowthDesc(), mark: '量' }
    case 'age': {
      const milestone = AGE[badge.id]?.() ?? ''
      return {
        title: milestone,
        description: m.badgeAgeDesc({ name: babyName, milestone }),
        mark: AGE_MARK[badge.id] ?? '',
      }
    }
    case 'family':
      return { title: m.badgeFamily(), description: m.badgeFamilyDesc(), mark: '家' }
    default:
      return badge.group satisfies never
  }
}

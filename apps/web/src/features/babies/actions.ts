import type { LocalStore } from '../../db'
import { type BabyInput, buildBaby } from './records'
import { selectBaby } from './use-babies'

export function createBaby(store: LocalStore, input: BabyInput) {
  const baby = buildBaby(input)
  store.babies.insert(baby)
  selectBaby(baby.id)
  return baby
}

export function updateBaby(store: LocalStore, id: string, input: BabyInput) {
  store.babies.update(id, (draft) => {
    Object.assign(draft, input)
    draft.updatedAt = Date.now()
  })
}

export function setBabyArchived(store: LocalStore, id: string, archived: boolean) {
  const now = Date.now()
  store.babies.update(id, (draft) => {
    draft.archivedAt = archived ? now : null
    draft.updatedAt = now
  })
}

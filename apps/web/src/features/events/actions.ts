import type { Event } from '@bobo/shared'

import type { LocalStore } from '../../db'

export function addEvent(store: LocalStore, event: Event) {
  store.events.insert(event)
}

/** Replaces an event with an updated version built by the pure helpers in records.ts. */
export function saveEvent(store: LocalStore, next: Event) {
  store.events.update(next.id, (draft) => {
    Object.assign(draft, next)
  })
}

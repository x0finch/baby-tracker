import { queryOptions } from '@tanstack/react-query'

import { getPushState } from './notifications'

export const reminderKeys = {
  /**
   * The reminders query collection is made per user (collection.ts), so its key carries the
   * user id; the rest of the account-side cache is cleared on sign-out.
   */
  list: (userId: string) => ['reminders', userId] as const,
  pushState: ['reminders', 'push-state'] as const,
}

export const reminderQueries = {
  /** Whether this device can and does receive notifications. */
  pushState: () => queryOptions({ queryKey: reminderKeys.pushState, queryFn: getPushState }),
}

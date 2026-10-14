import { QueryClient } from '@tanstack/react-query'

import { HttpError } from './api'

/**
 * Server state that isn't part of local-first sync (members, invites, reminders, passkeys).
 * Records themselves live in TanStack DB; this client only caches account-side lists.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (401, 403, 404) won't change on retry; network and 5xx might.
        retry: (failures, error) =>
          failures < 2 && !(error instanceof HttpError && error.status < 500),
      },
      mutations: { retry: false },
    },
  })
}

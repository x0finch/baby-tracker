import { queryOptions } from '@tanstack/react-query'

import { httpAccountApi } from './account'
import { listPasskeys } from './passkey'

// Not keyed by user: signing out clears the whole query cache (AccountCard).

/** Kept on the device across reloads and offline (lib/persist-queries.ts). */
const persist = { persist: true }

export const accountKeys = {
  me: ['account', 'me'] as const,
  passkeys: ['account', 'passkeys'] as const,
}

export const accountQueries = {
  me: () =>
    queryOptions({ queryKey: accountKeys.me, queryFn: () => httpAccountApi.me(), meta: persist }),
  passkeys: () =>
    queryOptions({ queryKey: accountKeys.passkeys, queryFn: listPasskeys, meta: persist }),
}

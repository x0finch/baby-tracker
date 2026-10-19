import { queryOptions } from '@tanstack/react-query'

import { httpAccountApi } from './account'
import { listPasskeys } from './passkey'

// Not keyed by user: signing out clears the whole query cache (AccountCard).

export const accountKeys = {
  me: ['account', 'me'] as const,
  passkeys: ['account', 'passkeys'] as const,
}

export const accountQueries = {
  me: () => queryOptions({ queryKey: accountKeys.me, queryFn: () => httpAccountApi.me() }),
  passkeys: () => queryOptions({ queryKey: accountKeys.passkeys, queryFn: listPasskeys }),
}

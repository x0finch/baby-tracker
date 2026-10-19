import { queryOptions } from '@tanstack/react-query'

import { familyApi } from './api'

// Not keyed by user: signing out clears the whole query cache.

export const familyKeys = {
  /** Everything about one family: invalidate it after inviting, editing or revoking. */
  all: (familyId: string) => ['family', familyId] as const,
  members: (familyId: string) => ['family', familyId, 'members'] as const,
  invites: (familyId: string) => ['family', familyId, 'invites'] as const,
  invite: (code: string) => ['invite', code] as const,
}

export const familyQueries = {
  /** Who invited you and to which family, shown before joining. Always fresh. */
  invitePreview: (code: string) =>
    queryOptions({
      queryKey: familyKeys.invite(code),
      queryFn: () => familyApi.previewInvite(code),
      staleTime: 0,
    }),
}

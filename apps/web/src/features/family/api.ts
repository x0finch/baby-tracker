import type {
  CreateInviteRequest,
  FamilyMember,
  FamilyRole,
  Invite,
  InvitePreview,
} from '@bobo/shared'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { apiFetch } from '../../lib/api'

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})
const familyPath = (familyId: string) => `/api/families/${encodeURIComponent(familyId)}`

export const familyApi = {
  members: (familyId: string) => apiFetch<FamilyMember[]>(`${familyPath(familyId)}/members`),
  updateMember: (
    familyId: string,
    userId: string,
    body: { role?: Exclude<FamilyRole, 'owner'>; babyIds?: string[] | null },
  ) =>
    apiFetch<void>(
      `${familyPath(familyId)}/members/${encodeURIComponent(userId)}`,
      json('PATCH', body),
    ),
  removeMember: (familyId: string, userId: string) =>
    apiFetch<void>(`${familyPath(familyId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
  rename: (familyId: string, name: string) =>
    apiFetch<void>(familyPath(familyId), json('PATCH', { name })),
  setAlias: (familyId: string, alias: string) =>
    apiFetch<void>(`${familyPath(familyId)}/alias`, json('PUT', { alias })),
  remove: (familyId: string) => apiFetch<void>(familyPath(familyId), { method: 'DELETE' }),
  transfer: (familyId: string, userId: string) =>
    apiFetch<void>(`${familyPath(familyId)}/transfer`, json('POST', { userId })),
  createInvite: (familyId: string, body: CreateInviteRequest) =>
    apiFetch<Invite>(`${familyPath(familyId)}/invites`, json('POST', body)),
  invites: (familyId: string) => apiFetch<Invite[]>(`${familyPath(familyId)}/invites`),
  revokeInvite: (familyId: string, code: string) =>
    apiFetch<void>(`${familyPath(familyId)}/invites/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),
  previewInvite: (code: string) =>
    apiFetch<InvitePreview>(`/api/invites/${encodeURIComponent(code)}`),
  acceptInvite: (code: string) =>
    apiFetch<{ familyId: string }>(`/api/invites/${encodeURIComponent(code)}/accept`, {
      method: 'POST',
    }),
}

export function inviteUrl(code: string): string {
  return new URL(`/join/${code}`, window.location.origin).toString()
}

export const familyKeys = {
  members: (familyId: string) => ['family', familyId, 'members'] as const,
  invites: (familyId: string) => ['family', familyId, 'invites'] as const,
}

// Member names rarely change; one fetch per family per app session is enough.
export const membersQuery = (familyId: string) =>
  queryOptions({
    queryKey: familyKeys.members(familyId),
    queryFn: () => familyApi.members(familyId),
    staleTime: Infinity,
  })

export const invitesQuery = (familyId: string) =>
  queryOptions({
    queryKey: familyKeys.invites(familyId),
    queryFn: () => familyApi.invites(familyId),
  })

export const invitePreviewQuery = (code: string) =>
  queryOptions({
    queryKey: ['invite', code],
    queryFn: () => familyApi.previewInvite(code),
    staleTime: 0,
  })

/** Members of a family, or undefined while loading, offline or signed out. */
export function useMembers(familyId: string | null | undefined) {
  return useQuery({ ...membersQuery(familyId ?? ''), enabled: Boolean(familyId) }).data
}

// Members already looked up again after a cache miss, so a member who left isn't refetched
// by every record that mentions them.
const refetchedFor = new Set<string>()

/** Display name of a family member; refetches once if they joined after the list was cached. */
export function useMemberName(familyId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const members = useMembers(familyId)
  const member = members?.find((item) => item.userId === userId)
  const missing = familyId !== null && userId !== null && members !== undefined && !member
  useEffect(() => {
    const key = `${familyId}:${userId}`
    if (!missing || !familyId || refetchedFor.has(key)) return
    refetchedFor.add(key)
    void queryClient.invalidateQueries({ queryKey: familyKeys.members(familyId) })
  }, [missing, familyId, userId, queryClient])
  return member?.name
}

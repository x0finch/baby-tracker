import type {
  CreateInviteRequest,
  FamilyMember,
  FamilyRole,
  Invite,
  InvitePreview,
} from '@bobo/shared'
import { useEffect, useState } from 'react'

import { apiFetch } from '../../sync/api'

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

// Member names rarely change; one fetch per family per app session is enough.
const memberCache = new Map<string, Promise<FamilyMember[]>>()

function loadMembers(familyId: string, refresh = false): Promise<FamilyMember[]> {
  let members = memberCache.get(familyId)
  if (!members || refresh) {
    members = familyApi.members(familyId)
    memberCache.set(familyId, members)
    // Retry on the next call if it failed (e.g. offline).
    members.catch(() => memberCache.delete(familyId))
  }
  return members
}

/** Members of a family, or undefined while loading, offline or signed out. */
export function useMembers(familyId: string | null | undefined, version = 0) {
  const [members, setMembers] = useState<FamilyMember[] | undefined>()
  useEffect(() => {
    if (!familyId) return undefined
    let current = true
    loadMembers(familyId, version > 0).then(
      (list) => current && setMembers(list),
      () => current && setMembers(undefined),
    )
    return () => {
      current = false
    }
  }, [familyId, version])
  return members
}

/** Display name of a family member; refetches once if they joined after the list was cached. */
export function useMemberName(familyId: string | null, userId: string | null) {
  const [name, setName] = useState<string | undefined>()
  useEffect(() => {
    if (!familyId || !userId) return undefined
    let current = true
    const find = (list: FamilyMember[]) => list.find((member) => member.userId === userId)
    loadMembers(familyId)
      .then((list) => find(list) ?? loadMembers(familyId, true).then(find))
      .then(
        (member) => current && setName(member?.name),
        () => undefined,
      )
    return () => {
      current = false
    }
  }, [familyId, userId])
  return name
}

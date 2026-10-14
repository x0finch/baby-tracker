import { z } from 'zod'

import type { Baby } from './baby'
import type { Event } from './event'

/** Maximum records per push request (babies and events combined). */
export const SYNC_PUSH_LIMIT = 500
/** Maximum records per table returned by one pull page. */
export const SYNC_PULL_LIMIT = 500

/** Items are validated one by one on the server so one bad record cannot block the rest. */
export const pushRequestSchema = z.object({
  babies: z.array(z.unknown()).default([]),
  events: z.array(z.unknown()).default([]),
})
export type PushRequest = { babies: Baby[]; events: Event[] }

export type PushStatus = 'accepted' | 'stale' | 'rejected'
export type PushRejectReason = 'invalid' | 'forbidden' | 'family_mismatch'

export interface PushItemResult {
  id: string
  /**
   * accepted: stored. stale: the server has a newer version (pull to get it).
   * rejected: will never be stored as sent; the client should drop its pending change.
   */
  status: PushStatus
  reason?: PushRejectReason
}

export interface PushResponse {
  babies: PushItemResult[]
  events: PushItemResult[]
}

export interface PullResponse {
  babies: Baby[]
  events: Event[]
  /** What the user can access now; clients drop data they lost access to (#31). */
  access: FamilySummary[]
  /** Opaque cursor to send with the next pull. */
  cursor: string
  hasMore: boolean
}

export const familyRoleSchema = z.enum(['owner', 'admin', 'caregiver', 'viewer'])
export type FamilyRole = z.infer<typeof familyRoleSchema>

export interface FamilySummary {
  id: string
  name: string
  role: FamilyRole
  /** Babies this member may see; null means every baby of the family. */
  babyIds: string[] | null
}

export const createFamilyRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
})

export interface FamilyMember {
  userId: string
  name: string
  image: string | null
  role: FamilyRole
  babyIds: string[] | null
}

export const updateMemberRequestSchema = z
  .object({
    role: familyRoleSchema.exclude(['owner']).optional(),
    /** null: every baby; otherwise only these babies of the family. */
    babyIds: z.array(z.string()).max(50).nullable().optional(),
  })
  .refine((body) => body.role !== undefined || body.babyIds !== undefined)

export const renameFamilyRequestSchema = createFamilyRequestSchema
export const transferOwnershipRequestSchema = z.object({ userId: z.string().min(1) })

/** How long an invite link stays valid. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const createInviteRequestSchema = z.object({
  role: familyRoleSchema.exclude(['owner']),
  /** null: every baby; otherwise only these babies of the family. */
  babyIds: z.array(z.string()).min(1).max(50).nullable(),
})
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>

export interface Invite {
  code: string
  familyId: string
  role: Exclude<FamilyRole, 'owner'>
  babyIds: string[] | null
  createdAt: number
  expiresAt: number
}

export type InviteStatus = 'active' | 'used' | 'revoked' | 'expired'

/** What someone opening an invite link sees before accepting it. */
export interface InvitePreview {
  familyName: string
  inviterName: string
  role: Exclude<FamilyRole, 'owner'>
  /** Names of the babies the invite grants, or null for every baby. */
  babyNames: string[] | null
  status: InviteStatus
}

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
}

export const createFamilyRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
})

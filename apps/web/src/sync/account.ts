import type { FamilySummary } from '@bobo/shared'

import type { LocalStore } from '../db'
import { HttpError, apiFetch } from './api'
import { markDirty, setAccount, setCursor } from './local'

export interface SessionUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface AccountApi {
  me: () => Promise<SessionUser | null>
  families: () => Promise<FamilySummary[]>
  createFamily: (name: string) => Promise<FamilySummary>
}

export const httpAccountApi: AccountApi = {
  async me() {
    try {
      return await apiFetch<SessionUser>('/api/me')
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return null
      throw error
    }
  },
  families: () => apiFetch<FamilySummary[]>('/api/families'),
  createFamily: (name) =>
    apiFetch<FamilySummary>('/api/families', { method: 'POST', body: JSON.stringify({ name }) }),
}

/** Starts Google sign-in; the browser leaves the app and returns to `returnTo`. */
export async function signInWithGoogle(returnTo = '/settings') {
  const { url } = await apiFetch<{ url: string }>('/api/auth/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({ provider: 'google', callbackURL: returnTo }),
  })
  window.location.assign(url)
}

export async function signOutRemote() {
  await apiFetch('/api/auth/sign-out', { method: 'POST', body: '{}' })
}

/** Babies and events created while signed out (not yet in any family). */
export function unclaimedCount(store: LocalStore): number {
  const babies = store.babies.toArray.filter((b) => b.familyId === null && b.deletedAt === null)
  return babies.length
}

/**
 * Moves everything created while signed out into a family and queues it for upload.
 * Events follow their baby, so a family's events always travel with its babies.
 */
export function claimLocalData(store: LocalStore, familyId: string, now: number = Date.now()) {
  for (const baby of store.babies.toArray) {
    if (baby.familyId !== null) continue
    const updatedAt = Math.max(now, baby.updatedAt)
    store.babies.update(baby.id, (draft) => Object.assign(draft, { familyId, updatedAt }))
    markDirty(store, 'babies', { ...baby, familyId, updatedAt })
  }
  for (const event of store.events.toArray) {
    if (event.familyId !== null) continue
    const babyFamily = store.babies.get(event.babyId)?.familyId ?? familyId
    const updatedAt = Math.max(now, event.updatedAt)
    store.events.update(event.id, (draft) =>
      Object.assign(draft, { familyId: babyFamily, updatedAt }),
    )
    markDirty(store, 'events', { ...event, familyId: babyFamily, updatedAt })
  }
}

export type ConnectResult =
  | { status: 'signed-out' }
  | { status: 'connected'; family: FamilySummary }
  /** The account already has a family and this device has its own records: ask the user. */
  | { status: 'choose'; families: FamilySummary[]; user: SessionUser }

/**
 * Links a signed-in account to this device. A new account gets a family with this device's
 * records; a device without local records joins the account's family and pulls its data.
 */
export async function connectAccount(
  store: LocalStore,
  api: AccountApi,
  defaultFamilyName: string,
): Promise<ConnectResult> {
  const user = await api.me()
  if (!user) return { status: 'signed-out' }
  const families = await api.families()
  if (families.length > 0 && unclaimedCount(store) > 0) return { status: 'choose', families, user }
  const family = families[0] ?? (await api.createFamily(defaultFamilyName))
  completeConnect(store, user, family)
  return { status: 'connected', family }
}

/** Finishes linking with the chosen family (also used after the user chooses). */
export function completeConnect(store: LocalStore, user: SessionUser, family: FamilySummary) {
  claimLocalData(store, family.id)
  setAccount(store, { userId: user.id, familyId: family.id })
}

/** Forgets the account on this device; optionally removes all local records too. */
export function disconnectLocal(store: LocalStore, clearData: boolean) {
  setAccount(store, undefined)
  // A later sign-in (possibly another account) starts from a full pull.
  setCursor(store, '')
  if (!clearData) return
  for (const collection of [store.events, store.babies, store.outbox] as const) {
    const keys = [...collection.keys()]
    if (keys.length > 0) collection.delete(keys)
  }
}

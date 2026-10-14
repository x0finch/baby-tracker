import { type FamilySummary } from '@bobo/shared'

import type { LocalStore } from '../../db'
import { createStore, useStore } from '../../lib/store'
import { getAccount, unclaimedCount } from '../../sync/local'
import { ownFamilyName, requestSync } from '../../sync/runner'
import { type SessionUser, completeConnect, connectAccount, httpAccountApi } from './account'

/** Pending "where should this device's records go?" decision after signing in. */
export interface ClaimChoice {
  user: SessionUser
  families: FamilySummary[]
  unclaimed: number
}

const claimChoice = createStore<ClaimChoice | null>(null)

export const useClaimChoice = (): ClaimChoice | null => useStore(claimChoice)

/** Links the session to this device if signed in and not linked yet (e.g. after OAuth). */
export async function connectIfSignedIn(store: LocalStore) {
  if (getAccount(store)) return
  try {
    const result = await connectAccount(store, httpAccountApi, ownFamilyName)
    if (result.status === 'connected') await requestSync()
    if (result.status === 'choose') {
      claimChoice.set({
        user: result.user,
        families: result.families,
        unclaimed: unclaimedCount(store),
      })
    }
  } catch (error) {
    // Offline or server unavailable: try again on the next app start.
    console.warn('Could not link the account', error)
  }
}

export async function resolveClaimChoice(store: LocalStore, family: FamilySummary | 'new') {
  const choice = claimChoice.get()
  if (!choice) return
  const { user } = choice
  const target = family === 'new' ? await httpAccountApi.createFamily(ownFamilyName(user)) : family
  completeConnect(store, user, target)
  claimChoice.set(null)
  await requestSync()
}

import { type FamilySummary } from '@bobo/shared'
import { useSyncExternalStore } from 'react'

import type { LocalStore } from '../db'
import { m } from '../paraglide/messages.js'
import { type SessionUser, completeConnect, connectAccount, httpAccountApi } from './account'
import { getAccount } from './local'
import { requestSync } from './runner'

/** Pending "where should this device's records go?" decision after signing in. */
export interface ClaimChoice {
  user: SessionUser
  families: FamilySummary[]
  unclaimed: number
}

let choice: ClaimChoice | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

export function useClaimChoice(): ClaimChoice | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => choice,
    () => null,
  )
}

/** Links the session to this device if signed in and not linked yet (e.g. after OAuth). */
export async function connectIfSignedIn(store: LocalStore, unclaimed: () => number) {
  if (getAccount(store)) return
  try {
    const result = await connectAccount(store, httpAccountApi, m.defaultFamilyName())
    if (result.status === 'connected') await requestSync()
    if (result.status === 'choose') {
      choice = { user: result.user, families: result.families, unclaimed: unclaimed() }
      emit()
    }
  } catch (error) {
    // Offline or server unavailable: try again on the next app start.
    console.warn('Could not link the account', error)
  }
}

export async function resolveClaimChoice(store: LocalStore, family: FamilySummary | 'new') {
  if (!choice) return
  const { user } = choice
  const target =
    family === 'new' ? await httpAccountApi.createFamily(m.defaultFamilyName()) : family
  completeConnect(store, user, target)
  choice = null
  emit()
  await requestSync()
}

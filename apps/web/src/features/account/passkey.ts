import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'

import { HttpError, apiFetch } from '../../lib/api'

export interface PasskeyInfo {
  id: string
  name?: string | null
  createdAt: string
}

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn()

/** The user dismissed the system prompt (or it timed out); not worth an error message. */
export function isPasskeyCancel(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
}

/** Signs in with a passkey saved on this device or a nearby phone. */
export async function signInWithPasskey(): Promise<void> {
  WebAuthnAbortService.cancelCeremony()
  const optionsJSON = await apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    '/api/auth/passkey/generate-authenticate-options',
  )
  const response = await startAuthentication({ optionsJSON })
  await apiFetch('/api/auth/passkey/verify-authentication', {
    method: 'POST',
    body: JSON.stringify({ response }),
  })
}

/**
 * Saves a passkey for the signed-in account. The server asks for a recent sign-in; an older
 * session gets a 403 and should sign in again first.
 */
export async function addPasskey(name: string): Promise<void> {
  const optionsJSON = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(
    `/api/auth/passkey/generate-register-options?name=${encodeURIComponent(name)}`,
  )
  const response = await startRegistration({ optionsJSON })
  await apiFetch('/api/auth/passkey/verify-registration', {
    method: 'POST',
    body: JSON.stringify({ response, name }),
  })
}

export const listPasskeys = () => apiFetch<PasskeyInfo[]>('/api/auth/passkey/list-user-passkeys')

export const deletePasskey = (id: string) =>
  apiFetch('/api/auth/passkey/delete-passkey', { method: 'POST', body: JSON.stringify({ id }) })

export const needsFreshSignIn = (error: unknown) =>
  error instanceof HttpError && error.status === 403

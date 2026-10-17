import { apiFetch } from '../../lib/api'

/** The Siri shortcut's phrase until the user picks another. */
export const DEFAULT_PHRASE = '记录宝宝'

/** The signed shortcut people add; it asks for their code once, on adding. */
export const SHORTCUT_URL = '/siri/bobo.shortcut'

export interface VoiceSettings {
  /** What the user says to Siri, i.e. the name they gave the shortcut. */
  phrase: string
  /** The code the shortcut uses, if one is active; the code itself is never shown again. */
  token: { createdAt: number; lastUsedAt: number | null } | null
  /** The user's families that have an AI model set up. */
  aiFamilies: { id: string; name: string }[]
  /** Whose AI the user's commands use; one of aiFamilies, or null when there are none. */
  aiFamilyId: string | null
}

export interface VoicePreview {
  /** What Siri would say back. */
  reply: string
  /** One line per record that would be added. */
  records: string[]
}

// The code made on this device, so signing out here can end it (another account may sign
// in next, and the shortcut would otherwise keep logging for this one).
const TOKEN_ID_KEY = 'bobo.voiceTokenId'

function rememberToken(id: string | null) {
  try {
    if (id) localStorage.setItem(TOKEN_ID_KEY, id)
    else localStorage.removeItem(TOKEN_ID_KEY)
  } catch {
    // Storage unavailable: signing out just won't end the code.
  }
}

/** Ends the code made on this device, if it is still the account's current one. */
export async function revokeThisDeviceToken() {
  let id: string | null = null
  try {
    id = localStorage.getItem(TOKEN_ID_KEY)
  } catch {
    return
  }
  if (!id) return
  await apiFetch<void>(`/api/voice/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  rememberToken(null)
}

export const voiceKeys = { settings: ['voice-settings'] as const }

export const voiceApi = {
  settings: () => apiFetch<VoiceSettings>('/api/voice'),
  update: (patch: { phrase?: string; aiFamilyId?: string }) =>
    apiFetch<VoiceSettings>('/api/voice', { method: 'PATCH', body: JSON.stringify(patch) }),
  /** Replaces any earlier code; the old one stops working at once. */
  createToken: async () => {
    const created = await apiFetch<{ id: string; token: string }>('/api/voice/token', {
      method: 'POST',
      // Times said aloud ("三点") are read in this device's zone.
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
    rememberToken(created.id)
    return created
  },
  revokeToken: async () => {
    await apiFetch<void>('/api/voice/token', { method: 'DELETE' })
    rememberToken(null)
  },
  preview: (text: string) =>
    apiFetch<VoicePreview>('/api/voice/preview', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
}

/**
 * Copies a code that is still being created. Safari only lets a tap write to the clipboard
 * while the tap is being handled, so the clipboard item is handed over at once and filled in
 * when the server answers.
 */
export async function copyWhenReady(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    return
  }
  await navigator.clipboard.writeText(await text)
}

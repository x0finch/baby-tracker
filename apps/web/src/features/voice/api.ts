import { apiFetch } from '../../lib/api'

/** The signed shortcut people add; it asks for their code once, on adding. */
export const SHORTCUT_URL = '/siri/bobo.shortcut'

/** One family's Siri shortcut. */
export interface VoiceShortcut {
  familyId: string
  familyName: string
  /** What the user says to Siri, i.e. the name they gave the shortcut. */
  phrase: string
  /** Whether the family has an AI model set up; without one nothing can be recorded. */
  hasAi: boolean
  /** The code the shortcut uses, if one is active; the code itself is never shown again. */
  token: { createdAt: number; lastUsedAt: number | null } | null
}

export interface VoiceSettings {
  /** One per family the user can record for, in the order they joined. */
  shortcuts: VoiceShortcut[]
}

/** The agent's answer to one message. */
export interface ChatTurn {
  reply: string
  /** The user said they're finished. */
  done: boolean
  /** A change is waiting for the user's yes or no. */
  confirming: boolean
}

export interface ChatMessage {
  /** Only for React lists; not stored. */
  id: string
  role: 'user' | 'assistant'
  text: string
}

// Codes made on this device, so signing out here can end them (another account may sign in
// next, and the shortcuts would otherwise keep logging for this one).
const TOKEN_IDS_KEY = 'bobo.voiceTokenIds'

function deviceTokenIds(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(TOKEN_IDS_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveDeviceTokenIds(ids: string[]) {
  try {
    if (ids.length > 0) localStorage.setItem(TOKEN_IDS_KEY, JSON.stringify(ids))
    else localStorage.removeItem(TOKEN_IDS_KEY)
  } catch {
    // Storage unavailable: signing out just won't end the codes.
  }
}

/** Ends the codes made on this device that are still the account's current ones. */
export async function revokeThisDeviceToken() {
  const ids = deviceTokenIds()
  await Promise.all(
    ids.map((id) =>
      apiFetch<void>(`/api/voice/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    ),
  )
  saveDeviceTokenIds([])
}

export const voiceKeys = {
  settings: ['voice-settings'] as const,
  chat: (familyId: string) => ['voice-chat', familyId] as const,
}

// Times said aloud ("三点") are read in this device's zone.
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const family = (familyId: string) => `/api/voice/families/${encodeURIComponent(familyId)}`

export const voiceApi = {
  settings: () => apiFetch<VoiceSettings>('/api/voice'),
  rename: (familyId: string, phrase: string) =>
    apiFetch<VoiceSettings>(family(familyId), {
      method: 'PATCH',
      body: JSON.stringify({ phrase }),
    }),
  /** Replaces any earlier code for the family; the old one stops working at once. */
  createToken: async (familyId: string) => {
    const created = await apiFetch<{ id: string; token: string }>(`${family(familyId)}/token`, {
      method: 'POST',
      body: JSON.stringify({ timeZone: timeZone() }),
    })
    saveDeviceTokenIds([...deviceTokenIds(), created.id])
    return created
  },
  revokeToken: (familyId: string) =>
    apiFetch<void>(`${family(familyId)}/token`, { method: 'DELETE' }),
  chat: (familyId: string) =>
    apiFetch<{ messages: ChatMessage[] }>(`${family(familyId)}/chat`).then((body) => body.messages),
  send: (familyId: string, text: string) =>
    apiFetch<ChatTurn>(`${family(familyId)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ text, timeZone: timeZone() }),
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

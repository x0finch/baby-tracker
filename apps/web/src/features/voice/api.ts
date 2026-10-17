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
}

export interface VoicePreview {
  /** What Siri would say back. */
  reply: string
  /** One line per record that would be added. */
  records: string[]
}

export const voiceKeys = { settings: ['voice-settings'] as const }

export const voiceApi = {
  settings: () => apiFetch<VoiceSettings>('/api/voice'),
  setPhrase: (phrase: string) =>
    apiFetch<VoiceSettings>('/api/voice', { method: 'PATCH', body: JSON.stringify({ phrase }) }),
  /** Replaces any earlier code; the old one stops working at once. */
  createToken: () => apiFetch<{ token: string }>('/api/voice/token', { method: 'POST' }),
  revokeToken: () => apiFetch<void>('/api/voice/token', { method: 'DELETE' }),
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

import { base64UrlDecode, base64UrlEncode } from '@bobo/shared'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'

export const AI_PROVIDERS = ['openai', 'openrouter'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

interface ProviderInfo {
  baseURL: string
  api: 'responses' | 'chat-completions'
  /** Shown first and preselected: small, fast, cheap, with strict structured outputs. */
  recommended: string[]
  /** Which listed models can run the assistant (chat models that call tools). */
  usable: (model: ListedModel) => boolean
  /** A cheap request that fails with a bad key. */
  keyCheck: string
}

interface ListedModel {
  id: string
  supported_parameters?: string[]
}

const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    api: 'responses',
    recommended: ['gpt-5.4-mini', 'gpt-5.4-nano'],
    usable: ({ id }) =>
      /^(gpt-|o\d)/.test(id) && !/(audio|realtime|image|tts|transcribe|search)/.test(id),
    keyCheck: 'https://api.openai.com/v1/models',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    api: 'chat-completions',
    recommended: ['openai/gpt-5.4-mini', 'google/gemini-3-flash', 'openai/gpt-5.4-nano'],
    usable: ({ supported_parameters: params = [] }) => params.includes('tools'),
    keyCheck: 'https://openrouter.ai/api/v1/key',
  },
}

export class AiKeyError extends Error {}

/** Checks a key and lists the models it can use for voice commands, recommended first. */
export async function listModels(provider: AiProvider, apiKey: string) {
  const info = PROVIDERS[provider]
  const auth = { Authorization: `Bearer ${apiKey}` }
  const check = await fetch(info.keyCheck, { headers: auth })
  if (!check.ok) throw new AiKeyError(`key check failed: ${check.status}`)
  const res =
    provider === 'openai' ? check : await fetch(`${info.baseURL}/models`, { headers: auth })
  if (!res.ok) throw new AiKeyError(`model list failed: ${res.status}`)
  const body: unknown = await res.json()
  const data =
    typeof body === 'object' && body !== null && 'data' in body && Array.isArray(body.data)
      ? body.data
      : []
  const ids = data
    .filter((item): item is ListedModel => typeof item?.id === 'string')
    .filter(info.usable)
    .map((item) => item.id)
  const recommended = info.recommended.filter((id) => ids.includes(id))
  const rest = ids.filter((id) => !recommended.includes(id)).toSorted()
  return [
    ...recommended.map((id) => ({ id, recommended: true })),
    ...rest.map((id) => ({ id, recommended: false })),
  ]
}

/** The model adapter for a family's saved settings. */
export function familyAdapter(provider: AiProvider, model: string, apiKey: string) {
  const info = PROVIDERS[provider]
  return openaiCompatibleText(model, { baseURL: info.baseURL, apiKey, api: info.api })
}

// Provider keys are encrypted at rest with a key derived from AI_KEY_SECRET.

async function cipherKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('bobo family ai key'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptKey(secret: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cipherKey(secret),
    new TextEncoder().encode(plain),
  )
  const out = new Uint8Array(iv.length + sealed.byteLength)
  out.set(iv)
  out.set(new Uint8Array(sealed), iv.length)
  return base64UrlEncode(out)
}

export async function decryptKey(secret: string, sealed: string): Promise<string> {
  const bytes = base64UrlDecode(sealed)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    await cipherKey(secret),
    bytes.slice(12),
  )
  return new TextDecoder().decode(plain)
}

/** "sk-…a3f9": enough to recognise a key, not enough to use it. */
export function keyHint(apiKey: string): string {
  const prefix = apiKey.startsWith('sk-or-') ? 'sk-or-' : apiKey.startsWith('sk-') ? 'sk-' : ''
  return `${prefix}…${apiKey.slice(-4)}`
}

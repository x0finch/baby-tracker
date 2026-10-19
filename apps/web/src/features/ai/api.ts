import { apiFetch } from '../../lib/api'

/** Model providers voice logging can use. */
export const AI_PROVIDERS = ['openai', 'openrouter'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

/** The user's own AI settings; keys never come back, only their last characters. */
export interface UserAi {
  /** One per provider. */
  keys: { provider: AiProvider; keyHint: string }[]
  /** The model voice commands use. */
  choice: { provider: AiProvider; model: string } | null
  /** Families the user shares it with. */
  sharedFamilyIds: string[]
}

/** The AIs members shared with a family, and the one it uses. */
export interface FamilyAi {
  /** The member whose AI the family uses; null when nobody shares one. */
  inUse: string | null
  shares: { userId: string; name: string; provider: AiProvider; model: string }[]
}

/** Why a recommended model is recommended. */
export type ModelTag = 'steady' | 'cheapest' | 'balanced'

export interface AiModel {
  id: string
  /** Set on recommended models, which come first. */
  tag?: ModelTag
  /** USD per million tokens, where the provider lists it (OpenRouter). */
  price?: { input: number; output: number }
  /** False for aliases, snapshots, batch, reasoning and expensive models: shown on request. */
  everyday: boolean
}

/** What each saved key can use; a key that stopped working says so. */
export type ProviderModels =
  | { provider: AiProvider; status: 'ok'; models: AiModel[] }
  | { provider: AiProvider; status: 'invalid' | 'unreachable' }

export const aiApi = {
  get: () => apiFetch<UserAi>('/api/ai'),
  models: () => apiFetch<{ providers: ProviderModels[] }>('/api/ai/models'),
  /** Checks and saves a key; the first key also picks the model. */
  saveKey: (provider: AiProvider, apiKey: string) =>
    apiFetch<UserAi>(`/api/ai/keys/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),
  removeKey: (provider: AiProvider) =>
    apiFetch<UserAi>(`/api/ai/keys/${provider}`, { method: 'DELETE' }),
  choose: (choice: { provider: AiProvider; model: string }) =>
    apiFetch<UserAi>('/api/ai', { method: 'PUT', body: JSON.stringify(choice) }),
  share: (familyIds: string[]) =>
    apiFetch<UserAi>('/api/ai/shares', { method: 'PUT', body: JSON.stringify({ familyIds }) }),
  family: (familyId: string) =>
    apiFetch<FamilyAi>(`/api/families/${encodeURIComponent(familyId)}/ai`),
  /** Owners and admins: use this member's shared AI. */
  chooseForFamily: (familyId: string, userId: string) =>
    apiFetch<FamilyAi>(`/api/families/${encodeURIComponent(familyId)}/ai`, {
      method: 'PUT',
      body: JSON.stringify({ userId }),
    }),
}

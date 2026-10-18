import { apiFetch } from '../../lib/api'

/** Model providers voice logging can use. */
export const AI_PROVIDERS = ['openai', 'openrouter'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
}

/** The user's own AI settings; the key itself never comes back, only its last characters. */
export interface UserAi {
  provider: AiProvider
  model: string
  keyHint: string
  /** Families the user shares it with. */
  sharedFamilyIds: string[]
}

/** The AIs members shared with a family, and the one it uses. */
export interface FamilyAi {
  /** The member whose AI the family uses; null when nobody shares one. */
  inUse: string | null
  shares: { userId: string; name: string; provider: AiProvider; model: string }[]
}

export interface AiModel {
  id: string
  /** Small, fast and good at this job: shown first. */
  recommended: boolean
}

export const aiKeys = {
  mine: ['user-ai'] as const,
  family: (familyId: string) => ['family-ai', familyId] as const,
}

export const aiApi = {
  get: () => apiFetch<UserAi | null>('/api/ai'),
  /** Checks a key by listing its models; without a key, uses the saved one. */
  models: (provider: AiProvider, apiKey: string | null) =>
    apiFetch<{ models: AiModel[] }>('/api/ai/models', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    }),
  save: (settings: { provider: AiProvider; model: string; apiKey: string | null }) =>
    apiFetch<UserAi>('/api/ai', { method: 'PUT', body: JSON.stringify(settings) }),
  share: (familyIds: string[]) =>
    apiFetch<UserAi>('/api/ai/shares', { method: 'PUT', body: JSON.stringify({ familyIds }) }),
  remove: () => apiFetch<void>('/api/ai', { method: 'DELETE' }),
  family: (familyId: string) => apiFetch<FamilyAi>(`/api/families/${familyId}/ai`),
  /** Owners and admins: use this member's shared AI. */
  choose: (familyId: string, userId: string) =>
    apiFetch<FamilyAi>(`/api/families/${familyId}/ai`, {
      method: 'PUT',
      body: JSON.stringify({ userId }),
    }),
}

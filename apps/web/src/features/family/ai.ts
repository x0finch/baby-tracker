import { apiFetch } from '../../lib/api'

/** Model providers a family can use for voice logging. */
export const AI_PROVIDERS = ['openai', 'openrouter'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

/** A family's AI settings; the key itself never comes back, only its last characters. */
export interface FamilyAi {
  provider: AiProvider
  model: string
  keyHint: string
}

export interface AiModel {
  id: string
  /** Small, fast and good at this job: shown first. */
  recommended: boolean
}

export const aiKeys = { family: (familyId: string) => ['family-ai', familyId] as const }

export const aiApi = {
  get: (familyId: string) => apiFetch<FamilyAi | null>(`/api/families/${familyId}/ai`),
  /** Checks a key by listing its models; without a key, uses the family's saved one. */
  models: (familyId: string, provider: AiProvider, apiKey: string | null) =>
    apiFetch<{ models: AiModel[] }>(`/api/families/${familyId}/ai/models`, {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    }),
  save: (
    familyId: string,
    settings: { provider: AiProvider; model: string; apiKey: string | null },
  ) =>
    apiFetch<FamilyAi>(`/api/families/${familyId}/ai`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  remove: (familyId: string) =>
    apiFetch<void>(`/api/families/${familyId}/ai`, { method: 'DELETE' }),
}

import type { PullResponse, PushRequest, PushResponse } from '@bobo/shared'

import { apiFetch } from '../lib/api'
import type { SyncApi } from './engine'

export const httpSyncApi: SyncApi = {
  push: (request: PushRequest) =>
    apiFetch<PushResponse>('/api/sync/push', { method: 'POST', body: JSON.stringify(request) }),
  pull: (cursor: string) =>
    apiFetch<PullResponse>(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`),
}

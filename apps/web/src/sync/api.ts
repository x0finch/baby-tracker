import type { PullResponse, PushRequest, PushResponse } from '@bobo/shared'

import type { SyncApi } from './engine'

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const res = await fetch(path, { ...init, credentials: 'same-origin', headers })
  if (!res.ok) throw new HttpError(res.status)
  // The API always answers with JSON; shapes are shared with the server via @bobo/shared.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await res.json()) as T
}

export const httpSyncApi: SyncApi = {
  push: (request: PushRequest) =>
    apiFetch<PushResponse>('/api/sync/push', { method: 'POST', body: JSON.stringify(request) }),
  pull: (cursor: string) =>
    apiFetch<PullResponse>(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`),
}

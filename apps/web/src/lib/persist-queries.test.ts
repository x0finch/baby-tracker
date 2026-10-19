import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { persistQueriesTo } from './persist-queries'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    size: () => items.size,
  }
}

/** A client with one query kept on the device and one that is not. */
async function signedIn(storage: ReturnType<typeof memoryStorage>, userId: string) {
  const queryClient = new QueryClient()
  const [stop] = persistQueriesTo(storage, queryClient, userId, 'b1')
  await queryClient.fetchQuery({
    queryKey: ['ai', 'mine'],
    queryFn: () => ({ model: 'deepseek' }),
    meta: { persist: true },
  })
  await queryClient.fetchQuery({ queryKey: ['voice', 'chat'], queryFn: () => ['hi'] })
  // Saving is asynchronous; let it land.
  await new Promise((resolve) => setTimeout(resolve, 10))
  stop()
}

async function reopen(storage: ReturnType<typeof memoryStorage>, userId: string, build = 'b1') {
  const queryClient = new QueryClient()
  const [stop, restored] = persistQueriesTo(storage, queryClient, userId, build)
  await restored
  stop()
  return queryClient
}

describe('persisted queries', () => {
  it('come back after a reload, only those marked to persist', async () => {
    const storage = memoryStorage()
    await signedIn(storage, 'u1')
    const queryClient = await reopen(storage, 'u1')
    expect(queryClient.getQueryData(['ai', 'mine'])).toEqual({ model: 'deepseek' })
    expect(queryClient.getQueryData(['voice', 'chat'])).toBeUndefined()
  })

  it("never show one account's data to another, or an old build's", async () => {
    const storage = memoryStorage()
    await signedIn(storage, 'u1')
    expect((await reopen(storage, 'u2')).getQueryData(['ai', 'mine'])).toBeUndefined()
    await signedIn(storage, 'u1')
    expect((await reopen(storage, 'u1', 'b2')).getQueryData(['ai', 'mine'])).toBeUndefined()
  })

  it('are deleted on sign-out', async () => {
    const storage = memoryStorage()
    await signedIn(storage, 'u1')
    expect(storage.size()).toBe(1)
    const [, done] = persistQueriesTo(storage, new QueryClient(), undefined, 'b1')
    await done
    expect(storage.size()).toBe(0)
  })
})

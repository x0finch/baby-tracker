import { runPersistenceConformance } from '@tanstack/ai-persistence/testkit'
import { afterAll } from 'vitest'

import { chatPersistence } from '../src/agent/persistence'
import { createTestEnv } from './d1'

// TanStack's own contract tests, against the D1 stores (fresh database each time).
const disposers: Array<() => Promise<void>> = []
afterAll(async () => {
  await Promise.all(disposers.map((dispose) => dispose()))
})

runPersistenceConformance(
  'D1 chat persistence',
  async () => {
    const { env, dispose } = await createTestEnv()
    disposers.push(dispose)
    return chatPersistence(env.DB)
  },
  {
    skip: ['activities', 'metadata', 'generationRuns', 'artifacts', 'blobs'],
    skipMethods: ['runs.listReclaimable'],
  },
)

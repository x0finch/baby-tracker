import { defineConfig } from 'vitest/config'

// Separate from the unit tests: these call real models and only run on request.
export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    testTimeout: 60 * 60_000,
    hookTimeout: 60_000,
  },
})

import { describe, expect, it } from 'vitest'

import { idSchema, newId } from './id'

describe('newId', () => {
  it('creates valid ULIDs', () => {
    expect(idSchema.safeParse(newId()).success).toBe(true)
  })

  it('sorts by creation order, even within the same millisecond', () => {
    const ids = Array.from({ length: 50 }, () => newId(1_760_000_000_000))
    expect(ids.toSorted()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rejects anything that is not a ULID', () => {
    expect(idSchema.safeParse('not-an-id').success).toBe(false)
    expect(idSchema.safeParse('').success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { decodeCursor, encodeCursor } from '../src/sync'

describe('sync cursor', () => {
  it('round-trips and restarts on garbage', () => {
    const cursor = {
      babies: [3, '01ABC'] as [number, string],
      events: [7, '01XYZ'] as [number, string],
    }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
    expect(decodeCursor('not-a-cursor')).toEqual({ babies: [0, ''], events: [0, ''] })
    expect(decodeCursor(undefined)).toEqual({ babies: [0, ''], events: [0, ''] })
  })
})

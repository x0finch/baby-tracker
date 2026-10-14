import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStore, createStoredValue, jsonCodec, stringCodec, stringList } from './store'

class MemoryStorage {
  data = new Map<string, string>()
  getItem = (key: string) => this.data.get(key) ?? null
  setItem = (key: string, value: string) => void this.data.set(key, value)
  removeItem = (key: string) => void this.data.delete(key)
}

describe('createStore', () => {
  it('notifies subscribers on set', () => {
    const store = createStore(1)
    const listener = vi.fn<() => void>()
    const unsubscribe = store.subscribe(listener)
    store.set(2)
    expect(store.get()).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.set(3)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('createStoredValue', () => {
  let storage: MemoryStorage
  const windowEvents = new EventTarget()

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', windowEvents)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads, writes and removes values', () => {
    const value = createStoredValue('k', stringCodec, null)
    expect(value.get()).toBeNull()
    value.set('a')
    expect(storage.getItem('k')).toBe('a')
    value.set(null)
    expect(storage.getItem('k')).toBeNull()
  })

  it('validates JSON and falls back on bad data', () => {
    storage.setItem('ids', '["a", 1, "b"]')
    expect(createStoredValue('ids', jsonCodec(stringList), []).get()).toEqual(['a', 'b'])
    storage.setItem('bad', '{not json')
    expect(createStoredValue('bad', jsonCodec(stringList), ['x']).get()).toEqual(['x'])
  })

  it('keeps working in memory when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const value = createStoredValue('k', stringCodec, null)
    value.set('kept')
    expect(value.get()).toBe('kept')
  })

  it('follows changes from other tabs while subscribed', () => {
    const value = createStoredValue('k', stringCodec, null)
    const listener = vi.fn<() => void>()
    const unsubscribe = value.subscribe(listener)
    storage.setItem('k', 'other-tab')
    windowEvents.dispatchEvent(Object.assign(new Event('storage'), { key: 'k' }))
    expect(value.get()).toBe('other-tab')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})

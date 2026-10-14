import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
  /** What the prerendered shell sees. */
  serverValue: T
}

/** The store's current value; re-renders when it changes. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.serverValue)
}

/** A module-level value React components can subscribe to (sync state, install prompt, …). */
export function createStore<T>(initial: T, serverValue: T = initial): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  const store: Store<T> = {
    get: () => value,
    set: (next) => {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    serverValue,
  }
  return store
}

export interface Codec<T> {
  parse: (raw: string) => T
  /** null removes the key, e.g. when the value is back to its default. */
  serialize: (value: T) => string | null
}

export const stringCodec: Codec<string | null> = {
  parse: (raw) => raw,
  serialize: (value) => value,
}

/** JSON with validation; `validate` throws or coerces anything unexpected. */
export const jsonCodec = <T>(validate: (value: unknown) => T): Codec<T> => ({
  parse: (raw) => validate(JSON.parse(raw)),
  serialize: (value) => JSON.stringify(value),
})

/** Keeps the strings of a JSON array, dropping anything else. */
export const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** The stored value, or undefined when missing, unreadable or storage is unavailable. */
export function readStored<T>(key: string, codec: Codec<T>): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : codec.parse(raw)
  } catch {
    return undefined
  }
}

/** Best effort: without storage (private mode) the value simply isn't kept. */
export function writeStored<T>(key: string, codec: Codec<T>, value: T) {
  try {
    const raw = codec.serialize(value)
    if (raw === null) localStorage.removeItem(key)
    else localStorage.setItem(key, raw)
  } catch {
    // Storage unavailable.
  }
}

/**
 * A per-device preference in localStorage, shared by every component that reads it. Falls back
 * to memory when storage is unavailable (private mode) and follows changes from other tabs.
 */
export function createStoredValue<T>(key: string, codec: Codec<T>, fallback: T): Store<T> {
  let cached: { value: T } | undefined
  const read = () => readStored(key, codec) ?? fallback

  const store = createStore<T>(fallback)
  const notify = store.set
  let subscribers = 0
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return
    cached = { value: read() }
    notify(cached.value)
  }

  const stored: Store<T> = {
    get: () => {
      if (typeof window === 'undefined') return fallback
      cached ??= { value: read() }
      return cached.value
    },
    set: (value) => {
      cached = { value }
      writeStored(key, codec, value)
      notify(value)
    },
    subscribe: (listener) => {
      const unsubscribe = store.subscribe(listener)
      if (subscribers++ === 0) window.addEventListener('storage', onStorage)
      return () => {
        unsubscribe()
        if (--subscribers === 0) window.removeEventListener('storage', onStorage)
      }
    },
    serverValue: fallback,
  }
  return stored
}

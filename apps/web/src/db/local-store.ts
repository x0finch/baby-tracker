import { type Baby, type Event, babySchema, eventSchema } from '@bobo/shared'
import {
  type Collection,
  createCollection,
  createIndexedDB,
  indexedDBCollectionOptions,
  localOnlyCollectionOptions,
} from '@tanstack/db'

const DB_NAME = 'bobo'
/** Bump when adding object stores. */
const DB_VERSION = 1
const STORES = ['babies', 'events'] as const

/**
 * - `persistent`: IndexedDB, and the browser agreed not to evict it under storage pressure.
 * - `best-effort`: IndexedDB, but the browser may evict it (e.g. a non-installed web app on iOS).
 * - `memory`: IndexedDB is unavailable (some private modes); data is lost on reload.
 */
export type StorageMode = 'persistent' | 'best-effort' | 'memory'

export interface OpenLocalStoreOptions {
  /** Injected in tests. */
  idbFactory?: IDBFactory
  /** Injected in tests; defaults to `navigator.storage.persist`. */
  requestPersistence?: () => Promise<boolean>
}

function createIndexedDBCollections(db: Awaited<ReturnType<typeof createIndexedDB>>) {
  return {
    babies: createCollection(
      indexedDBCollectionOptions({
        db,
        name: 'babies',
        schema: babySchema,
        getKey: (baby) => baby.id,
      }),
    ),
    events: createCollection(
      indexedDBCollectionOptions({
        db,
        name: 'events',
        schema: eventSchema,
        getKey: (event) => event.id,
      }),
    ),
  }
}

function createMemoryCollections() {
  return {
    babies: createCollection(
      localOnlyCollectionOptions({ schema: babySchema, getKey: (baby) => baby.id }),
    ),
    events: createCollection(
      localOnlyCollectionOptions({ schema: eventSchema, getKey: (event) => event.id }),
    ),
  }
}

/** Backend-agnostic view of the collections; utils differ per storage backend. */
export interface LocalStore {
  babies: Collection<Baby, string>
  events: Collection<Event, string>
  mode: StorageMode
}

async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/**
 * Opens the on-device store. This is the storage seam: the native (Capacitor) build will
 * provide SQLite-backed collections with the same shape (#47).
 */
export async function openLocalStore(options: OpenLocalStoreOptions = {}): Promise<LocalStore> {
  let db: Awaited<ReturnType<typeof createIndexedDB>>
  try {
    db = await createIndexedDB({
      name: DB_NAME,
      version: DB_VERSION,
      stores: STORES,
      idbFactory: options.idbFactory,
    })
  } catch (error) {
    console.warn('IndexedDB unavailable, falling back to in-memory storage', error)
    return { ...createMemoryCollections(), mode: 'memory' }
  }

  const persisted = await (options.requestPersistence ?? requestPersistentStorage)()
  return { ...createIndexedDBCollections(db), mode: persisted ? 'persistent' : 'best-effort' }
}

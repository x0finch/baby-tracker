import { SHORTCUT_ICLOUD_ID, SHORTCUT_NAME } from '@bobo/shared'
import { Hono } from 'hono'

import type { AppEnv } from '../types'

// The Siri shortcut's signed file, for `shortcuts://import-shortcut?url=…`, which opens the
// Shortcuts app's add sheet straight from the installed app. Shortcuts imports only signed
// files, and signing needs a Mac signed in to iCloud, so the file is the one iCloud signed
// when the shortcut was shared. Its download link expires within the hour; the record has a
// fresh one on every read.

const RECORD_URL = `https://www.icloud.com/shortcuts/api/records/${SHORTCUT_ICLOUD_ID}`
/** Kept at the edge for this long, under the expiry of iCloud's download links. */
const CACHE_SECONDS = 600

interface ShortcutRecord {
  fields?: { signedShortcut?: { value?: { downloadURL?: string } } }
}

async function signedShortcut(): Promise<Response | null> {
  const record = await fetch(RECORD_URL)
  if (!record.ok) return null
  const body: ShortcutRecord = await record.json()
  const url = body.fields?.signedShortcut?.value?.downloadURL
  if (!url) return null
  const file = await fetch(url.replace('${f}', encodeURIComponent(`${SHORTCUT_NAME}.shortcut`)))
  return file.ok ? file : null
}

export const shortcutRoutes = new Hono<AppEnv>().get('/', async (c) => {
  // The Workers cache; absent in tests and local Node runs.
  const cache = typeof caches === 'undefined' ? null : caches.default
  const cached = await cache?.match(c.req.raw)
  if (cached) return cached
  const file = await signedShortcut().catch((error: unknown) => {
    console.error('Fetching the signed shortcut failed', error)
    return null
  })
  if (!file) return c.json({ error: 'unavailable' }, 502)
  const response = new Response(file.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${SHORTCUT_NAME}.shortcut`)}`,
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  })
  if (cache) c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()))
  return response
})

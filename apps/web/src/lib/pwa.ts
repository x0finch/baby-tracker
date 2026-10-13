import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Workbox } from 'workbox-window'

/** Installed to the home screen (or running in the native shell later). */
export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as macOS.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function'
}

// Chrome fires beforeinstallprompt once, possibly before React mounts, so capture it early.
let installPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isBeforeInstallPromptEvent(event)) return
    event.preventDefault()
    installPrompt = event
    for (const listener of installListeners) listener()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    for (const listener of installListeners) listener()
  })
}

/** The deferred Android/Chrome install prompt, if the browser offered one. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const prompt = useSyncExternalStore(
    (onChange) => {
      installListeners.add(onChange)
      return () => installListeners.delete(onChange)
    },
    () => installPrompt,
    () => null,
  )
  if (!prompt) return null
  return async () => {
    await prompt.prompt()
    await prompt.userChoice
    installPrompt = null
    for (const listener of installListeners) listener()
  }
}

/**
 * Registers the service worker in production builds and reports when a new version is
 * waiting. Applying it is left to the user so an update never interrupts logging.
 */
export function useServiceWorkerUpdate(): (() => void) | null {
  const [workbox, setWorkbox] = useState<Workbox | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return undefined
    let cancelled = false
    // Loaded in the browser only: the package is CommonJS on the server, where the shell
    // is prerendered, and it is not needed for the first paint.
    void import('workbox-window').then(({ Workbox }) => {
      if (cancelled) return
      const wb = new Workbox('/sw.js')
      wb.addEventListener('waiting', () => {
        if (!cancelled) setWorkbox(wb)
      })
      // Reload once the new worker takes over after the user accepted the update.
      wb.addEventListener('controlling', () => window.location.reload())
      void wb.register()
    })
    return () => {
      cancelled = true
    }
  }, [])

  return workbox ? () => workbox.messageSkipWaiting() : null
}

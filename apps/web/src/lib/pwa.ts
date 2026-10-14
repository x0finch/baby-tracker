import { useEffect, useRef, useState } from 'react'
import type { Workbox } from 'workbox-window'

import { createStore, useStore } from './store'

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
const installPrompt = createStore<BeforeInstallPromptEvent | null>(null)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isBeforeInstallPromptEvent(event)) return
    event.preventDefault()
    installPrompt.set(event)
  })
  window.addEventListener('appinstalled', () => installPrompt.set(null))
}

/** The deferred Android/Chrome install prompt, if the browser offered one. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const prompt = useStore(installPrompt)
  if (!prompt) return null
  return async () => {
    await prompt.prompt()
    await prompt.userChoice
    installPrompt.set(null)
  }
}

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Asks the browser to look for a new service worker; the "waiting" event follows if there is one. */
function checkForUpdate() {
  if (document.visibilityState !== 'visible' || !navigator.onLine) return
  // Ask the browser directly: Workbox's update() is a no-op until its own register() has
  // resolved, which it may not have in a long-lived page.
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.update())
    .catch(() => undefined)
}

/**
 * Registers the service worker in production builds and reports when a new version is
 * waiting. Applying it is left to the user so an update never interrupts logging.
 */
export function useServiceWorkerUpdate(): (() => void) | null {
  const [workbox, setWorkbox] = useState<Workbox | null>(null)
  // A worker also takes control on the very first visit (clients.claim); reloading then
  // would interrupt onboarding, so only reload after the user asked for the update.
  const accepted = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return undefined
    let cancelled = false
    let stopChecks: () => void = () => undefined
    // Loaded in the browser only: the package is CommonJS on the server, where the shell
    // is prerendered, and it is not needed for the first paint.
    void import('workbox-window').then(({ Workbox }) => {
      if (cancelled) return
      const wb = new Workbox('/sw.js')
      wb.addEventListener('waiting', () => {
        if (!cancelled) setWorkbox(wb)
      })
      // Reload once the new worker takes over after the user accepted the update.
      wb.addEventListener('controlling', () => {
        if (accepted.current) window.location.reload()
      })
      void wb.register()

      // Browsers only look for a new worker when a page loads. An installed app can stay
      // open in the background for days, so also look when it comes back to the
      // foreground, and every hour while it stays open.
      document.addEventListener('visibilitychange', checkForUpdate)
      const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
      stopChecks = () => {
        document.removeEventListener('visibilitychange', checkForUpdate)
        clearInterval(interval)
      }
    })
    return () => {
      cancelled = true
      stopChecks()
    }
  }, [])

  return workbox
    ? () => {
        accepted.current = true
        workbox.messageSkipWaiting()
      }
    : null
}

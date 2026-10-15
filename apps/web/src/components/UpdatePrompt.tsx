import { useLocation } from '@tanstack/react-router'

import { useServiceWorker, useWaitingUpdate } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Toast, ToastAction } from './ui/Toast'

export function UpdatePrompt() {
  useServiceWorker()
  const update = useWaitingUpdate()
  const onAboutPage = useLocation({ select: (location) => location.pathname === '/settings/about' })
  // An update the user found with "check for updates" already has its button on that page.
  if (!update || (update.foundBy === 'user' && onAboutPage)) return null
  return (
    <Toast action={<ToastAction onClick={update.apply}>{m.updateNow()}</ToastAction>}>
      {m.updateAvailable()}
    </Toast>
  )
}

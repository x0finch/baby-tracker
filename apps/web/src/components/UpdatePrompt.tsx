import { useServiceWorker, useWaitingUpdate } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Toast, ToastAction } from './ui/Toast'

export function UpdatePrompt() {
  useServiceWorker()
  const update = useWaitingUpdate()
  // An update the user found with "check for updates" already has its own button there.
  if (!update || update.foundBy === 'user') return null
  return (
    <Toast action={<ToastAction onClick={update.apply}>{m.updateNow()}</ToastAction>}>
      {m.updateAvailable()}
    </Toast>
  )
}

import { useServiceWorker, useWaitingUpdate } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Toast, ToastAction } from './ui/Toast'

export function UpdatePrompt() {
  useServiceWorker()
  const update = useWaitingUpdate()
  if (!update) return null
  return (
    <Toast action={<ToastAction onClick={update}>{m.updateNow()}</ToastAction>}>
      {m.updateAvailable()}
    </Toast>
  )
}

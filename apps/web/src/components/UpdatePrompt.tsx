import { useServiceWorkerUpdate } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Toast } from './ui/Toast'

export function UpdatePrompt() {
  const update = useServiceWorkerUpdate()
  if (!update) return null
  return (
    <Toast>
      <span>{m.updateAvailable()}</span>
      <button type="button" className="min-h-11 px-2 font-extrabold text-primary" onClick={update}>
        {m.updateNow()}
      </button>
    </Toast>
  )
}

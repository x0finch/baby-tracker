import { isIos, isStandalone, useInstallPrompt } from '../lib/pwa'
import { m } from '../paraglide/messages.js'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

/** Encourages installing the PWA; hidden once running from the home screen. */
export function InstallCard() {
  const install = useInstallPrompt()
  if (isStandalone()) return null

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.installTitle()}</h2>
      <p className="m-0 text-fg-muted">{m.installBody()}</p>
      {install ? (
        <Button block onClick={() => void install()}>
          {m.installButton()}
        </Button>
      ) : (
        <p className="m-0 font-bold">{isIos() ? m.installIosSteps() : m.installAndroidSteps()}</p>
      )}
    </Card>
  )
}

import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { buttonClass } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { m } from '../../paraglide/messages.js'

/** What a page offers once signed in, with a way to sign in and come back here. */
export function SignInNotice({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <Card className="flex flex-col gap-3">
      <p className="m-0 text-fg-muted">{children}</p>
      <Link
        to="/settings/account"
        search={{ returnTo: pathname }}
        className={buttonClass({ block: true })}
      >
        {m.signInOrUpAction()}
      </Link>
    </Card>
  )
}

import { Link, useHydrated } from '@tanstack/react-router'

import { m } from '../paraglide/messages.js'

const tabs = [
  { to: '/', label: m.tabToday },
  { to: '/stats', label: m.tabStats },
  { to: '/settings', label: m.tabSettings },
] as const

export function TabBar() {
  // The tab bar is part of the prerendered SPA shell, which is always rendered for `/`.
  // React keeps mismatched attributes from hydration, so a deep link would keep the
  // shell's active tab. Remounting after hydration recreates the DOM with the real state.
  const hydrated = useHydrated()

  return (
    <nav
      key={hydrated ? 'client' : 'shell'}
      className="fixed inset-x-0 bottom-0 mx-auto flex h-tab-bar-safe [view-transition-name:tab-bar] max-w-app border-t-2 border-border bg-bg pr-safe-0 pb-safe-0 pl-safe-0"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          // Sub-pages keep their section's tab active.
          activeOptions={{ exact: tab.to === '/' }}
          className="flex min-h-touch flex-1 items-center justify-center font-extrabold text-fg-muted aria-[current=page]:text-primary-text"
        >
          {tab.label()}
        </Link>
      ))}
    </nav>
  )
}

import { Link, useHydrated } from '@tanstack/react-router'

import { messages } from '../messages'

const tabs = [
  { to: '/', label: messages.tabToday },
  { to: '/stats', label: messages.tabStats },
  { to: '/settings', label: messages.tabSettings },
] as const

export function TabBar() {
  // The tab bar is part of the prerendered SPA shell, which is always rendered for `/`.
  // React keeps mismatched attributes from hydration, so a deep link would keep the
  // shell's active tab. Remounting after hydration recreates the DOM with the real state.
  const hydrated = useHydrated()

  return (
    <nav key={hydrated ? 'client' : 'shell'} className="tab-bar">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} className="tab-bar-item" activeOptions={{ exact: true }}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

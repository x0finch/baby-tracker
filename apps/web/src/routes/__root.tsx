import { APP_NAME } from '@bobo/shared'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { TabBar } from '../components/TabBar'
import { THEME_COLORS, themeInitScript } from '../lib/theme'

import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: THEME_COLORS.light },
      { title: APP_NAME },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The inline theme script sets data-theme before hydration.
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col">
      <main className="flex-1 px-[calc(16px+env(safe-area-inset-right))] pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(var(--spacing-tab-bar)+16px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

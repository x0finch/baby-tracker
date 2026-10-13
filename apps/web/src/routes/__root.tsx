import { APP_NAME } from '@bobo/shared'
import { HeadContent, Outlet, Scripts, createRootRoute, useHydrated } from '@tanstack/react-router'
import { type ReactNode, Suspense, useEffect } from 'react'

import { TabBar } from '../components/TabBar'
import { getLocale } from '../lib/i18n'
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
    <html lang={getLocale()} suppressHydrationWarning>
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
  // The prerendered shell never contains page content. Rendering pages only after
  // hydration keeps the first client render identical to the shell; otherwise a page
  // whose data is already available (the local store opens fast) would mismatch.
  const hydrated = useHydrated()
  // The shell is prerendered in the base locale; reflect the resolved locale for
  // screen readers and font selection.
  useEffect(() => {
    document.documentElement.lang = getLocale()
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col">
      <main className="flex-1 px-[calc(16px+env(safe-area-inset-right))] pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(var(--spacing-tab-bar)+16px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]">
        {/* Pages suspend while the local store opens (a few ms on startup). */}
        {hydrated && (
          <Suspense>
            <Outlet />
          </Suspense>
        )}
      </main>
      <TabBar />
    </div>
  )
}

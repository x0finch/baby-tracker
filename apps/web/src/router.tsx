import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { pageTransition } from './lib/page-transition'
import { createQueryClient } from './lib/query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createQueryClient()
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Page changes animate by direction (styles/app.css); search-only changes don't.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) =>
        fromLocation && pathChanged
          ? [pageTransition(fromLocation.pathname, toLocation.pathname)]
          : false,
    },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

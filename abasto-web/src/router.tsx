import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { watchRouteEntrance } from '#/components/layout/route-entrance'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Crossfade the page only when the path changes; search-param updates
    // (filters, dialogs) stay instant. See "Route transition" in styles.css.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) =>
        fromLocation && fromLocation.pathname === toLocation.pathname
          ? false
          : ['route'],
    },
  })

  watchRouteEntrance(router)

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { clearRootSession } from '#/components/layout/root-session'
import { RoutePending } from '#/components/layout/route-pending'
import { watchRouteEntrance } from '#/components/layout/route-entrance'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // A skeleton shows after 150ms of loading and stays at least 300ms, so
    // slow loaders never leave the old page frozen and fast ones never flash.
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    // Revisits within 30s render from cache and refresh in the background;
    // mutations call router.invalidate() to bypass it. Hover preloads reuse
    // the same window.
    defaultStaleTime: 30_000,
    defaultPreloadStaleTime: 30_000,
    // Crossfade the page only when the path changes; search-param updates
    // (filters, dialogs) stay instant. See "Route transition" in styles.css.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) =>
        fromLocation && fromLocation.pathname === toLocation.pathname
          ? false
          : ['route'],
    },
  })

  // Any invalidation (login, logout, a saved mutation) drops the cached
  // session/business so the next load reads them fresh.
  const invalidate = router.invalidate.bind(router)
  router.invalidate = (opts) => {
    clearRootSession()
    return invalidate(opts)
  }

  watchRouteEntrance(router)

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

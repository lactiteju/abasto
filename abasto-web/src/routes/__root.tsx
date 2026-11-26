import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { loadRootSession } from '#/components/layout/root-session'
import { AppShell } from '#/components/layout/app-shell'
import {
  decideRouteAccess,
  isStorePath,
} from '#/modules/access/lib/route-access'
import { getSessionUser } from '#/modules/access/server/session'
import { workspace } from '#/config/workspace'
import { getBusinessFn } from '#/modules/business/server/business'
import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
    const { user, business } = await loadRootSession(async () => {
      const [sessionUser, businessInfo] = await Promise.all([
        getSessionUser(),
        // Loaded once for the whole app; a failed read must not take the app down.
        getBusinessFn().then(
          (result) => (result.ok ? result.data : { ...workspace.business }),
          () => ({ ...workspace.business }),
        ),
      ])
      return { user: sessionUser, business: businessInfo }
    })
    const access = decideRouteAccess(user?.role ?? null, location.pathname)
    if (access.kind === 'redirect') {
      if (access.to === '/login') {
        throw redirect({
          to: '/login',
          search: { redirect: access.keepTarget ? location.href : undefined },
        })
      }
      throw redirect({ to: access.to })
    }
    return { user, business }
  },
  head: ({ match }) => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Operación mayorista · Tejulacteos',
      },
      {
        name: 'description',
        content: `${match.context.business.name}: etiquetas por lote, promociones con margen, mostrador, caja, reportes de mermas e importación CSV`,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

/** Login and the customer store render bare; staff pages sit inside the shell. */
function RootLayout() {
  const { user } = Route.useRouteContext()
  const pathname = useLocation({ select: (location) => location.pathname })
  if (!user || pathname === '/login' || isStorePath(pathname)) {
    return <Outlet />
  }
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

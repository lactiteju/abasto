import { createFileRoute } from '@tanstack/react-router'

import { parseExecutiveSearch } from '#/modules/executive/lib/search'
import type { ExecutiveSearch } from '#/modules/executive/lib/search'
import { ManagerReportsPage } from '#/modules/reports/components/manager/manager-reports-page'
import { MonthlyResultsPage } from '#/modules/reports/components/monthly/monthly-results-page'
import { OwnerReportsPage } from '#/modules/reports/components/owner/owner-reports-page'
import { parseManagerReportsSearch } from '#/modules/reports/lib/manager-search'
import type { ManagerReportsSearch } from '#/modules/reports/lib/manager-search'
import { parseMonthlySearch } from '#/modules/reports/lib/monthly-search'
import type { MonthlySearch } from '#/modules/reports/lib/monthly-search'
import { loadManagerReports } from '#/modules/reports/server/load-manager-reports'
import { loadMonthlyResults } from '#/modules/reports/server/load-monthly-results'
import { loadOwnerReports } from '#/modules/reports/server/load-owner-reports'

/** The owner and manager views share one URL; each reads only its own keys. */
type ReportsSearch = ManagerReportsSearch & ExecutiveSearch & MonthlySearch

const parseReportsSearch = (raw: Record<string, unknown>): ReportsSearch => ({
  ...parseManagerReportsSearch(raw),
  ...parseExecutiveSearch(raw),
  ...parseMonthlySearch(raw),
})

export const Route = createFileRoute('/reportes')({
  validateSearch: parseReportsSearch,
  loaderDeps: ({ search }) => search,
  // One loader per view and role: a manager never reaches an owner server function.
  loader: async ({ context, deps }) => {
    if (deps.vista === 'resultados') {
      return {
        role: 'resultados',
        managed: context.user?.role !== 'owner',
        load: await loadMonthlyResults(deps),
      } as const
    }
    return context.user?.role === 'owner'
      ? ({ role: 'owner', load: await loadOwnerReports(deps) } as const)
      : ({ role: 'manager', load: await loadManagerReports(deps) } as const)
  },
  component: ReportsRoute,
})

function ReportsRoute() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { user } = Route.useRouteContext()
  const onSearch = (patch: Partial<ReportsSearch>) =>
    void navigate({
      search: (current) => parseReportsSearch({ ...current, ...patch }),
    })
  if (data.role === 'resultados') {
    return (
      <MonthlyResultsPage
        load={data.load}
        search={search}
        onSearch={onSearch}
        userName={user?.name}
        managed={data.managed}
      />
    )
  }
  return data.role === 'owner' ? (
    <OwnerReportsPage
      load={data.load}
      search={search}
      onSearch={onSearch}
      userName={user?.name}
    />
  ) : (
    <ManagerReportsPage
      load={data.load}
      search={search}
      onSearch={onSearch}
      userName={user?.name}
    />
  )
}

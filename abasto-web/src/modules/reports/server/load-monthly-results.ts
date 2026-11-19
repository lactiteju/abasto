import { ClientError, unwrap } from '#/lib/boundary'
import { businessDate } from '#/modules/orders/services/clock'
import { monthOf } from '#/modules/reports/lib/monthly-search'
import type { MonthlySearch } from '#/modules/reports/lib/monthly-search'
import { monthlyResultsFn } from '#/modules/reports/server/monthly-results'
import type { MonthlyResultsLoad } from '#/modules/reports/types/monthly-results'

export type MonthlyResultsPageLoad =
  { allowed: false } | ({ allowed: true } & MonthlyResultsLoad)

type MonthlyFilters = MonthlySearch & { almacen?: string; proveedor?: string }

/**
 * Loads "Resultados del mes" for the owner or a manager; the service decides
 * which warehouses each may see. Anyone else gets `allowed: false`.
 */
export async function loadMonthlyResults(
  search: MonthlyFilters,
): Promise<MonthlyResultsPageLoad> {
  try {
    const load = unwrap(
      await monthlyResultsFn({
        data: {
          month: monthOf(search, businessDate()),
          warehouseId: search.almacen,
          supplierId: search.proveedor,
        },
      }),
    )
    return { allowed: true, ...load }
  } catch (error) {
    if (error instanceof ClientError) {
      if (error.code === 'forbidden') return { allowed: false }
      // A bad month or a warehouse that is not theirs: say so on the page.
      if (error.code === 'invalid') {
        return {
          allowed: true,
          warehouses: [],
          suppliers: [],
          error: error.message,
        }
      }
    }
    throw error
  }
}

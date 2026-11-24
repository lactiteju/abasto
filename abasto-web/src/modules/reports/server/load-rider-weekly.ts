import { ClientError, unwrap } from '#/lib/boundary'
import type { RiderWeeklySearch } from '#/modules/reports/lib/rider-weekly-search'
import { riderWeeklyFn } from '#/modules/reports/server/rider-weekly'
import type { RiderWeeklyLoad } from '#/modules/reports/types/rider-weekly'

export type RiderWeeklyPageLoad =
  { allowed: false } | ({ allowed: true } & RiderWeeklyLoad)

type WeeklyFilters = RiderWeeklySearch & {
  almacen?: string
  proveedor?: string
}

/**
 * Loads "Repartos" for the owner or a manager; the service decides which
 * warehouses each may see. Anyone else gets `allowed: false`.
 */
export async function loadRiderWeekly(
  search: WeeklyFilters,
): Promise<RiderWeeklyPageLoad> {
  try {
    const load = unwrap(
      await riderWeeklyFn({
        data: {
          weekStart: search.semana,
          warehouseId: search.almacen,
          supplierId: search.proveedor,
        },
      }),
    )
    return { allowed: true, ...load }
  } catch (error) {
    if (error instanceof ClientError) {
      if (error.code === 'forbidden') return { allowed: false }
      // A future week or a warehouse that is not theirs: say so on the page.
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

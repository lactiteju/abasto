import { ClientError, unwrap } from '#/lib/boundary'
import type { MonthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import { monthlyResultsFn } from '#/modules/reports/server/monthly-results'

export type MonthlyExcelKind = 'daily' | 'boxes'

/** Month of the period on screen: the YYYY-MM of its last day. */
export const monthOfRange = (range: { to: string }) => range.to.slice(0, 7)

/**
 * Loads the month for the warehouse and supplier on screen and saves one of
 * the two Excel files. ExcelJS loads on click, outside the first bundle.
 */
export async function downloadMonthExcel(
  kind: MonthlyExcelKind,
  filters: { month: string; warehouseId?: string; supplierId?: string },
  meta: MonthlyExportMeta,
) {
  const load = unwrap(await monthlyResultsFn({ data: filters }))
  if (!load.data) {
    throw new ClientError(
      'unexpected',
      load.error ?? 'No se pudo generar el archivo.',
    )
  }
  const xlsx = await import('#/modules/reports/lib/monthly-results-xlsx')
  if (kind === 'daily') await xlsx.downloadDailySalesXlsx(load.data, meta)
  else await xlsx.downloadBoxesXlsx(load.data, meta)
}

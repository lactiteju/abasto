import { ClientError, unwrap } from '#/lib/boundary'
import type { MonthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import { monthlyResultsFn } from '#/modules/reports/server/monthly-results'

export type MonthlyExcelKind = 'daily' | 'boxes'

/**
 * Loads the range of days on screen for its warehouse and supplier and saves
 * one of the two Excel files. ExcelJS loads on click, outside the first bundle.
 */
export async function downloadRangeExcel(
  kind: MonthlyExcelKind,
  filters: {
    from: string
    to: string
    warehouseId?: string
    supplierId?: string
  },
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

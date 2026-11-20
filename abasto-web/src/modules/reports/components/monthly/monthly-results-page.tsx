import { useState } from 'react'

import { useBusiness } from '#/modules/business/hooks/use-business'
import { businessDate } from '#/modules/orders/services/clock'
import { MonthlyDailyChart } from '#/modules/reports/components/monthly/monthly-daily-chart'
import { monthName } from '#/modules/reports/components/monthly/monthly-format'
import { MonthlyHeader } from '#/modules/reports/components/monthly/monthly-header'
import type { MonthlyDownload } from '#/modules/reports/components/monthly/monthly-header'
import { MonthlyKpis } from '#/modules/reports/components/monthly/monthly-kpis'
import { MonthlyProducts } from '#/modules/reports/components/monthly/monthly-products'
import { ReportEmpty } from '#/modules/reports/components/report-empty'
import { ReportViewSwitch } from '#/modules/reports/components/report-view-switch'
import { monthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import { monthOf, shiftMonth } from '#/modules/reports/lib/monthly-search'
import type { MonthlySearch } from '#/modules/reports/lib/monthly-search'
import type { MonthlyResultsPageLoad } from '#/modules/reports/server/load-monthly-results'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

export type MonthlyViewSearch = MonthlySearch & {
  almacen?: string
  proveedor?: string
}

type MonthlyResultsPageProps = {
  load: MonthlyResultsPageLoad
  search: MonthlyViewSearch
  onSearch: (patch: Partial<MonthlyViewSearch>) => void
  /** Who is signed in; printed on the exports. */
  userName?: string
  /** A manager sees only the warehouses they run. */
  managed?: boolean
  /** Business date; only tests set it. */
  today?: string
}

const downloadError =
  'No se pudo generar el archivo. Intenta de nuevo; si sigue igual, avisa a soporte.'

/** "Resultados del mes": the client's monthly sheet on screen, and its downloads. */
export function MonthlyResultsPage({
  load,
  search,
  onSearch,
  userName,
  managed = false,
  today = businessDate(),
}: MonthlyResultsPageProps) {
  const business = useBusiness()
  const [busy, setBusy] = useState<MonthlyDownload | null>(null)
  const [failed, setFailed] = useState(false)
  if (!load.allowed) {
    return (
      <ReportEmpty>
        Los reportes son para el dueño y los encargados de almacén.
      </ReportEmpty>
    )
  }
  const { data } = load
  const month = monthOf(search, today)
  const currentMonth = today.slice(0, 7)
  const picked = load.warehouses.find(
    (item) =>
      item.id ===
      (search.almacen ?? (managed ? load.warehouses.at(0)?.id : undefined)),
  )
  const supplier = load.suppliers.find((item) => item.id === search.proveedor)
  const scope = [
    picked
      ? picked.name
      : `Todo el negocio · ${load.warehouses.length} almacenes`,
    supplier && `Proveedor ${supplier.name}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const download = async (kind: MonthlyDownload) => {
    if (!data) return
    setBusy(kind)
    setFailed(false)
    try {
      const meta = monthlyExportMeta(
        business.name,
        picked ? `Almacén ${scope}` : scope,
        userName,
      )
      // Loaded on click: the document libraries stay out of the first bundle.
      if (kind === 'daily') {
        const { downloadDailySalesXlsx } =
          await import('#/modules/reports/lib/monthly-results-xlsx')
        await downloadDailySalesXlsx(data, meta)
      } else if (kind === 'boxes') {
        const { downloadBoxesXlsx } =
          await import('#/modules/reports/lib/monthly-results-xlsx')
        await downloadBoxesXlsx(data, meta)
      } else {
        const { downloadMonthlyResultsPdf } =
          await import('#/modules/reports/lib/monthly-results-pdf')
        await downloadMonthlyResultsPdf(data, meta)
      }
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <ReportViewSwitch value="resultados" onChange={onSearch} />
      <MonthlyHeader
        month={month}
        currentMonth={currentMonth}
        scope={scope}
        warehouses={load.warehouses}
        suppliers={load.suppliers}
        warehouseId={search.almacen}
        supplierId={search.proveedor}
        managed={managed}
        busy={busy}
        canDownload={Boolean(data && data.totals.orders > 0)}
        error={failed ? downloadError : undefined}
        onMonth={(step) => {
          const next = shiftMonth(month, step)
          onSearch({ mes: next === currentMonth ? undefined : next })
        }}
        onWarehouse={(almacen) => onSearch({ almacen })}
        onSupplier={(proveedor) => onSearch({ proveedor })}
        onDownload={(kind) => void download(kind)}
      />
      {load.error && <ReportEmpty>{load.error}</ReportEmpty>}
      {data &&
        (data.totals.orders > 0 ? (
          <Results data={data} today={today} />
        ) : (
          <ReportEmpty>
            Sin ventas en {monthName(data.month)} con estos filtros. Prueba con
            otro mes o quita el proveedor.
          </ReportEmpty>
        ))}
    </>
  )
}

function Results({ data, today }: { data: MonthlyResults; today: string }) {
  const previousMonth = shiftMonth(data.month, -1)
  return (
    <div className="grid min-w-0 gap-5">
      <MonthlyKpis
        totals={data.totals}
        previous={data.previous}
        previousName={monthName(previousMonth)}
      />
      <MonthlyDailyChart results={data} today={today} />
      <MonthlyProducts results={data} />
    </div>
  )
}

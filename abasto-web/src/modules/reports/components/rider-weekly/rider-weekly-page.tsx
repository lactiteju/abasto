import { useMemo, useState } from 'react'

import { useBusiness } from '#/modules/business/hooks/use-business'
import { businessDate } from '#/modules/orders/services/clock'
import { ReportEmpty } from '#/modules/reports/components/report-empty'
import { ReportViewSwitch } from '#/modules/reports/components/report-view-switch'
import { RiderWeeklyCards } from '#/modules/reports/components/rider-weekly/rider-weekly-cards'
import { RiderWeeklyDays } from '#/modules/reports/components/rider-weekly/rider-weekly-days'
import { RiderWeeklyHeader } from '#/modules/reports/components/rider-weekly/rider-weekly-header'
import { RiderWeeklyTable } from '#/modules/reports/components/rider-weekly/rider-weekly-table'
import { monthlyExportMeta } from '#/modules/reports/lib/monthly-results-export-meta'
import type { MonthlySearch } from '#/modules/reports/lib/monthly-search'
import type { RiderWeeklySearch } from '#/modules/reports/lib/rider-weekly-search'
import { buildWeeklySheet } from '#/modules/reports/lib/rider-weekly-sheet'
import { shiftWeek, weekOf } from '#/modules/reports/lib/rider-weekly-week'
import type { RiderWeeklyPageLoad } from '#/modules/reports/server/load-rider-weekly'

export type RiderWeeklyViewSearch = MonthlySearch &
  RiderWeeklySearch & { almacen?: string; proveedor?: string }

type RiderWeeklyPageProps = {
  load: RiderWeeklyPageLoad
  search: RiderWeeklyViewSearch
  onSearch: (patch: Partial<RiderWeeklyViewSearch>) => void
  /** Who is signed in; printed on the export. */
  userName?: string
  /** Business date; only tests set it. */
  today?: string
}

const downloadError =
  'No se pudo generar el archivo. Intenta de nuevo; si sigue igual, avisa a soporte.'

/** "Repartos": the weekly sheet of the riders on screen, and its Excel. */
export function RiderWeeklyPage({
  load,
  search,
  onSearch,
  userName,
  today = businessDate(),
}: RiderWeeklyPageProps) {
  const business = useBusiness()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const data = load.allowed ? load.data : undefined
  const day = data && picked && data.days.includes(picked) ? picked : null
  const sheet = useMemo(
    () => (data ? buildWeeklySheet(data, day) : undefined),
    [data, day],
  )
  const active = useMemo(
    () =>
      new Set(
        (data?.cells ?? [])
          .filter((cell) => cell.units > 0 || cell.scrapUnits > 0)
          .map((cell) => cell.day),
      ),
    [data],
  )
  if (!load.allowed) {
    return (
      <ReportEmpty>
        Los reportes son para el dueño y los encargados de almacén.
      </ReportEmpty>
    )
  }
  const week = data?.weekStart ?? weekOf(search.semana, today)
  const currentWeek = weekOf(undefined, today)
  const supplier = load.suppliers.find((item) => item.id === load.supplierId)
  const warehouse = load.warehouses.find((item) => item.id === load.warehouseId)
  const scope = [
    warehouse?.name,
    supplier ? `Proveedor ${supplier.name}` : 'Todos los proveedores',
  ]
    .filter(Boolean)
    .join(' · ')
  const empty = !active.size

  const download = async () => {
    if (!data) return
    setBusy(true)
    setFailed(false)
    try {
      const meta = monthlyExportMeta(business.name, scope, userName)
      // Loaded on click: ExcelJS stays out of the first bundle.
      const { downloadRiderWeeklyXlsx } =
        await import('#/modules/reports/lib/rider-weekly-xlsx')
      await downloadRiderWeeklyXlsx(data, meta)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ReportViewSwitch value="repartos" onChange={onSearch} />
      <RiderWeeklyHeader
        weekStart={week}
        currentWeek={currentWeek}
        scope={scope}
        warehouses={load.warehouses}
        suppliers={load.suppliers}
        warehouseId={load.warehouseId}
        supplierId={load.supplierId}
        busy={busy}
        canDownload={Boolean(data) && !empty}
        error={failed ? downloadError : undefined}
        onWeek={(step) => {
          setPicked(null)
          const next = shiftWeek(week, step)
          onSearch({ semana: next === currentWeek ? undefined : next })
        }}
        onWarehouse={(almacen) => onSearch({ almacen })}
        onSupplier={(proveedor) => onSearch({ proveedor })}
        onDownload={() => void download()}
      />
      {load.error && <ReportEmpty>{load.error}</ReportEmpty>}
      {data && sheet && (
        <div className="grid min-w-0 gap-5">
          <RiderWeeklyDays
            days={data.days}
            value={day}
            active={active}
            onChange={setPicked}
          />
          {empty ? (
            <ReportEmpty>
              Sin repartos liquidados en esta semana con estos filtros. Prueba
              con otra semana u otro proveedor.
            </ReportEmpty>
          ) : (
            <>
              <RiderWeeklyCards
                cards={[
                  ...sheet.riders.map((rider, index) => ({
                    id: rider.id,
                    name: rider.label,
                    metrics: sheet.totals.byRider[index],
                  })),
                  {
                    id: 'total',
                    name: day ? 'Total del día' : 'Total de la semana',
                    total: true,
                    metrics: {
                      units: sheet.totals.totalUnits,
                      revenueCents: sheet.totals.revenueCents,
                      depotProfitCents: sheet.totals.depotProfitCents,
                      routeProfitCents: sheet.totals.routeProfitCents,
                      scrapUnits: sheet.totals.scrapUnits,
                    },
                  },
                ]}
              />
              <RiderWeeklyTable sheet={sheet} />
            </>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Table model of "Repartos", shared by the screen and the Excel export: one
 * sheet per day and the weekly one. Pure: no document libraries.
 *
 * Ganancia depósito = venta − costo real − pago a ruta; ganancia ruta = pago
 * a ruta; ganancia total = venta − costo (the two added).
 */
import { daySheetName } from '#/modules/reports/lib/rider-weekly-week'
import type {
  RiderWeeklyCell,
  RiderWeeklyReport,
} from '#/modules/reports/types/rider-weekly'

export type SheetMetrics = {
  units: number
  revenueCents: number
  depotProfitCents: number
  routeProfitCents: number
  scrapUnits: number
}

type Rollup = {
  /** Pieces sold by every rider. */
  totalUnits: number
  scrapUnits: number
  revenueCents: number
  depotProfitCents: number
  routeProfitCents: number
  totalProfitCents: number
}

export type SheetRow = Rollup & {
  productId: string
  sku: string
  name: string
  boxFactor: number
  routePayPerBoxCents: number
  pieceCents: number
  /** One entry per rider of the sheet, same order. */
  byRider: Array<SheetMetrics>
}

export type SheetTotals = Rollup & { byRider: Array<SheetMetrics> }

export type SheetRider = { id: string; name: string; label: string }

export type WeeklySheet = {
  /** The business date, or `semanal`. */
  id: string
  /** Sheet tab: "16 NOV", "SEMANAL". */
  name: string
  /** "RUTAS LALA TEJUPILCO". */
  title: string
  riders: Array<SheetRider>
  rows: Array<SheetRow>
  totals: SheetTotals
}

export const weeklySheetName = 'SEMANAL'

const emptyMetrics = (): SheetMetrics => ({
  units: 0,
  revenueCents: 0,
  depotProfitCents: 0,
  routeProfitCents: 0,
  scrapUnits: 0,
})

const add = (into: SheetMetrics, cell: RiderWeeklyCell) => {
  into.units += cell.units
  into.revenueCents += cell.revenueCents
  into.depotProfitCents +=
    cell.revenueCents - cell.costCents - cell.routePayCents
  into.routeProfitCents += cell.routePayCents
  into.scrapUnits += cell.scrapUnits
}

const rollup = (byRider: ReadonlyArray<SheetMetrics>): Rollup => {
  const sum = (pick: (metrics: SheetMetrics) => number) =>
    byRider.reduce((total, metrics) => total + pick(metrics), 0)
  const depotProfitCents = sum((m) => m.depotProfitCents)
  const routeProfitCents = sum((m) => m.routeProfitCents)
  return {
    totalUnits: sum((m) => m.units),
    scrapUnits: sum((m) => m.scrapUnits),
    revenueCents: sum((m) => m.revenueCents),
    depotProfitCents,
    routeProfitCents,
    totalProfitCents: depotProfitCents + routeProfitCents,
  }
}

const sumMetrics = (list: ReadonlyArray<SheetMetrics>): SheetMetrics =>
  list.reduce(
    (total, item) => ({
      units: total.units + item.units,
      revenueCents: total.revenueCents + item.revenueCents,
      depotProfitCents: total.depotProfitCents + item.depotProfitCents,
      routeProfitCents: total.routeProfitCents + item.routeProfitCents,
      scrapUnits: total.scrapUnits + item.scrapUnits,
    }),
    emptyMetrics(),
  )

/** "RUTAS LALA TEJUPILCO" (without supplier: "RUTAS TEJUPILCO"). */
export const weeklyTitle = (report: RiderWeeklyReport) =>
  ['RUTAS', report.supplier?.name, report.warehouse.name]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()

/** "RUTA 1 / LUIS". */
const riderLabel = (name: string, index: number) =>
  `RUTA ${index + 1} / ${name.toUpperCase()}`

/** Sheet of one business day, or of the whole week when `day` is null. */
export function buildWeeklySheet(
  report: RiderWeeklyReport,
  day: string | null,
): WeeklySheet {
  const riders = report.riders.map((rider, index) => ({
    id: rider.id,
    name: rider.name,
    label: riderLabel(rider.name, index),
  }))
  const riderIndex = new Map(riders.map((rider, index) => [rider.id, index]))
  const rowIndex = new Map(
    report.products.map((product, index) => [product.productId, index]),
  )
  const grid = report.products.map(() => riders.map(() => emptyMetrics()))
  for (const cell of report.cells) {
    if (day !== null && cell.day !== day) continue
    const row = rowIndex.get(cell.productId)
    const column = riderIndex.get(cell.riderId)
    if (row === undefined || column === undefined) continue
    add(grid[row][column], cell)
  }
  const rows = report.products.map((product, index): SheetRow => ({
    productId: product.productId,
    sku: product.sku,
    name: product.name,
    boxFactor: product.boxFactor,
    routePayPerBoxCents: product.routePayPerBoxCents,
    pieceCents: product.pieceCents,
    byRider: grid[index],
    ...rollup(grid[index]),
  }))
  const totalsByRider = riders.map((_, column) =>
    sumMetrics(grid.map((row) => row[column])),
  )
  return {
    id: day ?? 'semanal',
    name: day === null ? weeklySheetName : daySheetName(day),
    title: weeklyTitle(report),
    riders,
    rows,
    totals: { byRider: totalsByRider, ...rollup(totalsByRider) },
  }
}

/** One sheet per day (Monday to Sunday) and the weekly one, last. */
export const buildWeeklySheets = (report: RiderWeeklyReport) => [
  ...report.days.map((day) => buildWeeklySheet(report, day)),
  buildWeeklySheet(report, null),
]

/** repartos-semana-2026-11-16.xlsx */
export const weeklyFilename = (weekStart: string) =>
  `repartos-semana-${weekStart}.xlsx`

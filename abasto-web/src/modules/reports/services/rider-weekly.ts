import { sql } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import type { Actor } from '#/modules/access/lib/policy'
import { businessDate } from '#/modules/orders/services/clock'
import { addDays, isBusinessDate } from '#/modules/reports/lib/period'
import {
  allSuppliers,
  defaultSupplier,
  routePayCents,
  weekDays,
  weekStartOf,
} from '#/modules/reports/lib/rider-weekly-week'
import {
  localDay,
  managedWarehouses,
  reportWarehouses,
  uuidList,
} from '#/modules/reports/services/report-scope'
import { listReportSuppliers } from '#/modules/reports/services/report-suppliers'
import { riderAllocationLines } from '#/modules/reports/services/sales-report'
import type {
  RiderWeeklyCell,
  RiderWeeklyLoad,
  RiderWeeklyProduct,
  RiderWeeklyReport,
} from '#/modules/reports/types/rider-weekly'

/** One delivery line of a rider on a day, with what its allocations moved. */
type LineRow = {
  day: string
  rider_id: string
  product_id: string
  box_factor: number
  route_pay_cents: number
  unit_cents: string
  units: string
  revenue: string
  cost: string
  scrap: string
}

type NameRow = { id: string; name: string; sku?: string }

/**
 * Settled deliveries of the warehouse inside the week, one row per delivery
 * line. The sale math is the sales report's (`riderAllocationLines`), so the
 * week adds up to "Resultados del mes" for the Reparto channel; cost stays an
 * exact fraction until a cell is rounded.
 */
async function lineRows(
  weekStart: string,
  warehouseId: string,
  supplierId?: string,
) {
  const range = { from: weekStart, to: addDays(weekStart, 6) }
  const result = await db.execute<LineRow>(sql`
    with lines as (${riderAllocationLines(range, [warehouseId], supplierId)})
    select to_char(${localDay(sql`s.closed_at`)}, 'YYYY-MM-DD') as day,
      s.rider_id::text as rider_id, s.product_id::text as product_id,
      max(s.box_factor) as box_factor, max(s.route_pay_cents) as route_pay_cents,
      max(s.unit_cents)::text as unit_cents,
      sum(s.base_quantity)::bigint as units,
      sum(s.line_total_cents)::bigint as revenue,
      sum(s.cost)::text as cost,
      sum(s.scrap_quantity)::bigint as scrap
    from lines s
    group by s.line_id, 1, 2, 3`)
  return result.rows
}

async function productNames(ids: ReadonlyArray<string>) {
  if (!ids.length) return []
  const result = await db.execute<NameRow>(sql`
    select id::text as id, name, sku from products
    where id in (${uuidList(ids)}) order by name, sku`)
  return result.rows
}

/** Active riders of the warehouse plus any rider with activity, by name. */
async function ridersOf(warehouseId: string, activeIds: ReadonlyArray<string>) {
  const known = activeIds.length
    ? sql`or id in (${uuidList(activeIds)})`
    : sql``
  const result = await db.execute<NameRow>(sql`
    select id::text as id, name from riders
    where (warehouse_id = ${warehouseId}::uuid and active) ${known}
    order by lower(name), id`)
  return result.rows
}

/** Cells of day × rider × product: lines add up, route pay is rounded per line. */
function cellsOf(rows: ReadonlyArray<LineRow>) {
  const cells = new Map<string, RiderWeeklyCell>()
  for (const row of rows) {
    const key = `${row.day}|${row.rider_id}|${row.product_id}`
    const cell = cells.get(key) ?? {
      day: row.day,
      riderId: row.rider_id,
      productId: row.product_id,
      units: 0,
      revenueCents: 0,
      costCents: 0,
      scrapUnits: 0,
      routePayCents: 0,
    }
    const units = Number(row.units)
    cell.units += units
    cell.revenueCents += Number(row.revenue)
    cell.costCents += Number(row.cost)
    cell.scrapUnits += Number(row.scrap)
    cell.routePayCents += routePayCents(
      units,
      row.route_pay_cents,
      row.box_factor,
    )
    cells.set(key, cell)
  }
  return [...cells.values()]
    .map((cell) => ({ ...cell, costCents: Math.round(cell.costCents) }))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.riderId.localeCompare(b.riderId) ||
        a.productId.localeCompare(b.productId),
    )
}

function productsOf(
  rows: ReadonlyArray<LineRow>,
  names: ReadonlyArray<NameRow>,
): Array<RiderWeeklyProduct> {
  const facts = new Map<string, RiderWeeklyProduct>()
  for (const row of rows) {
    const known = facts.get(row.product_id)
    facts.set(row.product_id, {
      productId: row.product_id,
      sku: '',
      name: '',
      boxFactor: Math.max(known?.boxFactor ?? 0, row.box_factor),
      routePayPerBoxCents: Math.max(
        known?.routePayPerBoxCents ?? 0,
        row.route_pay_cents,
      ),
      pieceCents: Math.max(known?.pieceCents ?? 0, Number(row.unit_cents)),
    })
  }
  return names.flatMap((item) => {
    const product = facts.get(item.id)
    return product ? [{ ...product, name: item.name, sku: item.sku ?? '' }] : []
  })
}

/** Week to report on: the Monday of the asked day, never a week that has not begun. */
function weekStartFor(input: string | undefined, today: string) {
  if (input !== undefined && !isBusinessDate(input)) {
    throw new AppError('invalid', 'Elige una semana válida.')
  }
  const start = weekStartOf(input ?? today)
  if (start > today) {
    throw new AppError('invalid', 'Elige una semana que no sea futura.')
  }
  return start
}

/**
 * Weekly report of the riders of one warehouse (Monday to Sunday). Each
 * settled delivery counts on the business day it was settled. Per day, rider
 * and product: pieces sold, sale, real cost, merma pieces and route pay
 * (frozen per box on the delivery line, prorated to the pieces sold, rounded
 * per line). The warehouse defaults to the actor's first managed one (the
 * owner's default warehouse first); the supplier to the one named like
 * "lala", else all (`proveedor=todos` forces all). Managers only see the
 * warehouses they run.
 */
export async function getRiderWeeklyReport(
  actor: Actor,
  input: { weekStart?: string; warehouseId?: string; supplierId?: string },
): Promise<RiderWeeklyLoad> {
  const managed = await managedWarehouses(actor)
  const warehouseId = input.warehouseId ?? managed.at(0)?.id
  if (!warehouseId) {
    return { warehouses: managed, suppliers: [], error: 'No hay almacenes.' }
  }
  const [warehouse] = await reportWarehouses(actor, [warehouseId])
  const suppliers = await listReportSuppliers()
  const supplier =
    input.supplierId === allSuppliers
      ? null
      : input.supplierId
        ? (suppliers.find((item) => item.id === input.supplierId) ?? null)
        : defaultSupplier(suppliers)
  if (input.supplierId && input.supplierId !== allSuppliers && !supplier) {
    throw new AppError('invalid', 'Elige un proveedor válido.')
  }
  const weekStart = weekStartFor(input.weekStart, businessDate())

  const rows = await lineRows(weekStart, warehouse.id, supplier?.id)
  const [names, riders] = await Promise.all([
    productNames([...new Set(rows.map((row) => row.product_id))]),
    ridersOf(warehouse.id, [...new Set(rows.map((row) => row.rider_id))]),
  ])
  const data: RiderWeeklyReport = {
    weekStart,
    days: weekDays(weekStart),
    warehouse,
    supplier,
    riders,
    products: productsOf(rows, names),
    cells: cellsOf(rows),
  }
  return {
    warehouses: managed,
    suppliers,
    warehouseId: warehouse.id,
    supplierId: supplier?.id ?? null,
    data,
  }
}

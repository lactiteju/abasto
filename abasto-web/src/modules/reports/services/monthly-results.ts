import { sql } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import type { Actor } from '#/modules/access/lib/policy'
import { businessDate } from '#/modules/orders/services/clock'
import { addDays } from '#/modules/reports/lib/period'
import {
  localDay,
  managedWarehouses,
  reportWarehouses,
  uuidList,
} from '#/modules/reports/services/report-scope'
import { listReportSuppliers } from '#/modules/reports/services/report-suppliers'
import { pickedUpLines } from '#/modules/reports/services/sales-report'
import type {
  MonthlyDay,
  MonthlyProductRow,
  MonthlyResults,
  MonthlyResultsLoad,
  MonthlyTotals,
} from '#/modules/reports/types/monthly-results'
import type { DateRange } from '#/modules/reports/types/reports'

type Scope = {
  ids: Array<string>
  supplierId?: string
  /** Every warehouse is in scope (owner without a warehouse filter). */
  all?: boolean
}

type TotalsRow = { orders: number; revenue: string; cost: string }
type DayRow = TotalsRow & { day: string }
type ProductRow = {
  id: string
  name: string
  sku: string
  unit: string
  units: string
  revenue: string
  cost: string
}
type CatalogRow = Pick<ProductRow, 'id' | 'name' | 'sku' | 'unit'>
type ProductDayRow = { id: string; day: string; units: string }
type PresentationRow = { product_id: string; name: string; factor: number }

type Box = { name: string; factor: number }

const dayKey = sql`to_char(${localDay(sql`s.closed_at`)}, 'YYYY-MM-DD')`
const aggregates = sql`
  count(distinct s.order_id)::int as orders,
  sum(s.line_total_cents)::bigint as revenue,
  round(sum(s.cost))::bigint as cost`

const twoDecimals = (value: number) => Math.round(value * 100) / 100

/** Calendar range of a `YYYY-MM` month; malformed or future months are refused. */
function monthRange(month: string, today: string): DateRange {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError('invalid', 'Elige un mes válido.')
  }
  if (month > today.slice(0, 7)) {
    throw new AppError('invalid', 'Elige un mes que no sea futuro.')
  }
  const [year, number] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, number, 1, 12))
  const to = addDays(next.toISOString().slice(0, 10), -1)
  return { from: `${month}-01`, to }
}

const previousRange = (range: DateRange): DateRange => {
  const to = addDays(range.from, -1)
  return { from: `${to.slice(0, 8)}01`, to }
}

const isSunday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() === 0

/** Box presentation: the one named "caja…", else the largest factor above 1. */
function boxesOf(
  rows: ReadonlyArray<PresentationRow>,
  units: ReadonlyMap<string, string>,
): Map<string, Box> {
  const result = new Map<string, Box>()
  const byProduct = new Map<string, Array<PresentationRow>>()
  for (const row of rows) {
    byProduct.set(row.product_id, [
      ...(byProduct.get(row.product_id) ?? []),
      row,
    ])
  }
  for (const [productId, items] of byProduct) {
    const larger = items.filter((item) => item.factor > 1)
    const pool = larger.filter((item) => /^caja/i.test(item.name.trim()))
    const best = (pool.length ? pool : larger).reduce<PresentationRow | null>(
      (top, item) => (!top || item.factor > top.factor ? item : top),
      null,
    )
    result.set(
      productId,
      best
        ? { name: best.name, factor: best.factor }
        : { name: units.get(productId) ?? '', factor: 1 },
    )
  }
  return result
}

async function runScoped<T extends Record<string, unknown>>(
  range: DateRange,
  scope: Scope,
  select: ReturnType<typeof sql>,
  tail: ReturnType<typeof sql>,
) {
  const result = await db.execute<T>(sql`
    with lines as (${pickedUpLines(range, scope.ids, scope.supplierId)})
    select ${select} from lines s ${tail}`)
  return result.rows
}

const byDayOf = (range: DateRange, scope: Scope) =>
  runScoped<DayRow>(
    range,
    scope,
    sql`${dayKey} as day, ${aggregates}`,
    sql`group by 1 order by 1`,
  )

const totalOf = (range: DateRange, scope: Scope) =>
  runScoped<TotalsRow>(range, scope, aggregates, sql``)

const productsOf = (range: DateRange, scope: Scope) =>
  runScoped<ProductRow>(
    range,
    scope,
    sql`p.id::text as id, p.name, p.sku, p.unit,
      sum(s.base_quantity)::bigint as units,
      sum(s.line_total_cents)::bigint as revenue,
      round(sum(s.cost))::bigint as cost`,
    sql`join products p on p.id = s.product_id group by p.id, p.name, p.sku, p.unit`,
  )

const productDaysOf = (range: DateRange, scope: Scope) =>
  runScoped<ProductDayRow>(
    range,
    scope,
    sql`s.product_id::text as id, ${dayKey} as day, sum(s.base_quantity)::bigint as units`,
    sql`group by 1, 2`,
  )

/**
 * Products of the sheet in catalog order (name, then SKU, as the catalog
 * lists them): active products of the supplier filter that are stocked or
 * priced in the scoped warehouses (every active product when all warehouses
 * are in scope), plus any product sold in the month even if archived since.
 */
async function catalogOf(scope: Scope, soldIds: ReadonlyArray<string>) {
  const supplier = scope.supplierId
    ? sql`and p.supplier_id::text = ${scope.supplierId}`
    : sql``
  const stocked = scope.all
    ? sql`true`
    : sql`(
        exists (select 1 from lots l
          where l.product_id = p.id and l.on_hand > 0
            and l.warehouse_id in (${uuidList(scope.ids)}))
        or exists (select 1 from presentation_prices pp
          join presentations pr on pr.id = pp.presentation_id
          where pr.product_id = p.id
            and pp.warehouse_id in (${uuidList(scope.ids)}))
      )`
  const sold = soldIds.length ? sql`p.id in (${uuidList(soldIds)})` : sql`false`
  const result = await db.execute<CatalogRow>(sql`
    select p.id::text as id, p.name, p.sku, p.unit from products p
    where ((p.archived_at is null and ${stocked}) or ${sold}) ${supplier}
    order by p.name, p.sku`)
  return result.rows
}

/** Base units on hand today per product in the scoped warehouses (stocked products only). */
async function stockOf(scope: Scope, productIds: ReadonlyArray<string>) {
  if (!productIds.length) return new Map<string, number>()
  const result = await db.execute<{ product_id: string; units: string }>(sql`
    select product_id::text as product_id, sum(on_hand)::bigint as units
    from lots
    where on_hand > 0 and warehouse_id in (${uuidList(scope.ids)})
      and product_id in (${uuidList(productIds)})
    group by product_id`)
  return new Map(result.rows.map((row) => [row.product_id, Number(row.units)]))
}

async function presentationsOf(productIds: ReadonlyArray<string>) {
  if (!productIds.length) return []
  const result = await db.execute<PresentationRow>(sql`
    select product_id::text as product_id, name, factor
    from presentations where product_id in (${uuidList(productIds)})`)
  return result.rows
}

const totalsFrom = (
  row: TotalsRow | undefined,
  boxes: number,
): MonthlyTotals => {
  const revenueCents = Number(row?.revenue ?? 0)
  const costCents = Number(row?.cost ?? 0)
  return {
    orders: row?.orders ?? 0,
    revenueCents,
    costCents,
    marginCents: revenueCents - costCents,
    boxes: twoDecimals(boxes),
  }
}

/** Month-by-month sales: scope rules of the manager dashboards, sales of the sales report. */
async function resolveScope(
  actor: Actor,
  input: { warehouseId?: string; supplierId?: string },
) {
  const managed = await managedWarehouses(actor)
  const chosen =
    input.warehouseId ??
    (actor.role === 'owner' ? undefined : managed.at(0)?.id)
  const covered = await reportWarehouses(actor, chosen ? [chosen] : undefined)
  return {
    warehouses: managed,
    scope: {
      ids: covered.map((item) => item.id),
      supplierId: input.supplierId,
      all: !chosen,
    },
  }
}

/**
 * The monthly sheet: per business day (Monday to Saturday, plus Sundays with
 * sales) sale, cost, margin and boxes, and per product the boxes of each day,
 * with the previous month's totals. Products cover the whole catalog scope,
 * unsold ones with zeros. Sales and cost are the sales report's.
 */
export async function getMonthlyResults(
  actor: Actor,
  input: { month: string; warehouseId?: string; supplierId?: string },
): Promise<MonthlyResultsLoad> {
  const today = businessDate()
  const range = monthRange(input.month, today)
  const { warehouses, scope } = await resolveScope(actor, input)
  const before = previousRange(range)
  const [
    suppliers,
    days,
    total,
    products,
    productDays,
    prevTotal,
    prevProducts,
  ] = await Promise.all([
    listReportSuppliers(),
    byDayOf(range, scope),
    totalOf(range, scope),
    productsOf(range, scope),
    productDaysOf(range, scope),
    totalOf(before, scope),
    productsOf(before, scope),
  ])
  const catalog = await catalogOf(
    scope,
    products.map((row) => row.id),
  )
  const stock = await stockOf(
    scope,
    catalog.map((row) => row.id),
  )
  const everyProduct = [...catalog, ...products, ...prevProducts]
  const boxes = boxesOf(
    await presentationsOf([...new Set(everyProduct.map((row) => row.id))]),
    new Map(everyProduct.map((row) => [row.id, row.unit])),
  )
  const factorOf = (id: string) => boxes.get(id)?.factor ?? 1
  const boxesSold = (rows: ReadonlyArray<ProductRow>) =>
    rows.reduce((sum, row) => sum + Number(row.units) / factorOf(row.id), 0)

  const dayBoxes = new Map<string, number>()
  const productBoxes = new Map<string, Record<string, number>>()
  for (const row of productDays) {
    const value = Number(row.units) / factorOf(row.id)
    dayBoxes.set(row.day, (dayBoxes.get(row.day) ?? 0) + value)
    const perDay = productBoxes.get(row.id) ?? {}
    perDay[row.day] = twoDecimals(value)
    productBoxes.set(row.id, perDay)
  }

  const sales = new Map(days.map((row) => [row.day, row]))
  const shown: Array<string> = []
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    if (!isSunday(day) || sales.has(day)) shown.push(day)
  }
  const byDay = shown.map((day): MonthlyDay => {
    const row = sales.get(day)
    const totals = totalsFrom(row, dayBoxes.get(day) ?? 0)
    return { day, ...totals }
  })

  const soldBy = new Map(products.map((row) => [row.id, row]))
  const rows = catalog
    .map((item, position): MonthlyProductRow => {
      const row = soldBy.get(item.id) ?? {
        ...item,
        units: '0',
        revenue: '0',
        cost: '0',
      }
      const box = boxes.get(row.id) ?? { name: row.unit, factor: 1 }
      const exact = Number(row.units) / box.factor
      const revenueCents = Number(row.revenue)
      const costCents = Number(row.cost)
      const marginCents = revenueCents - costCents
      return {
        productId: row.id,
        name: row.name,
        sku: row.sku,
        stockUnits: stock.get(row.id) ?? 0,
        position,
        boxName: box.name,
        boxFactor: box.factor,
        boxesByDay: productBoxes.get(row.id) ?? {},
        boxes: twoDecimals(exact),
        revenueCents,
        costCents,
        marginCents,
        marginPerBoxCents: exact > 0 ? Math.round(marginCents / exact) : null,
      }
    })
    .sort((a, b) => b.marginCents - a.marginCents || a.position - b.position)

  const data: MonthlyResults = {
    month: input.month,
    range,
    through: today.slice(0, 7) === input.month ? today : range.to,
    days: shown,
    byDay,
    products: rows,
    totals: totalsFrom(total[0], boxesSold(products)),
    previous: totalsFrom(prevTotal[0], boxesSold(prevProducts)),
  }
  return { warehouses, suppliers, data }
}

/**
 * Table models of "Resultados del mes", shared by the Excel and PDF exports.
 * Pure: no document libraries. Dates are plain YYYY-MM-DD business dates and
 * are formatted at UTC noon so no timezone can shift the calendar day.
 */
import type {
  MonthlyResults,
  MonthlyProductRow,
} from '#/modules/reports/types/monthly-results'

const parts = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return { year, month, date }
}

const atNoon = (day: string) => {
  const { year, month, date } = parts(day)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

const longDate = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const monthName = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  month: 'long',
})
const monthShort = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  month: 'short',
})
const grouped = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const twoDecimals = (value: number) => Math.round(value * 100) / 100

const two = (value: number) => String(value).padStart(2, '0')

/** "lunes, 2 de noviembre de 2026". */
export const longDateLabel = (day: string) => longDate.format(atNoon(day))

/** "02": day of month, two digits. */
export const dayHeader = (day: string) => two(parts(day).date)

/** "Resultados de noviembre 2026" for a YYYY-MM month. */
export const monthTitle = (month: string) =>
  `Resultados de ${monthName.format(atNoon(`${month}-01`))} ${month.slice(0, 4)}`

/** Cents as "$ 208,925.70" (negatives "-$ 10.05"). */
export const moneyLabel = (cents: number) =>
  `${cents < 0 ? '-' : ''}$ ${grouped.format(Math.abs(cents) / 100)}`

const groupedBoxes = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Boxes with up to two decimals and no trailing zeros: 12.5 → "12.5", 6 → "6". */
export const boxesLabel = (boxes: number) =>
  groupedBoxes.format(Math.round(boxes * 100) / 100)

/**
 * Excel number format that prints `boxesLabel`. "#,##0.##" would show "6.",
 * so whole numbers get no decimal part at all.
 */
export const boxesNumFmt = (boxes: number) =>
  Number.isInteger(Math.round(boxes * 100) / 100) ? '#,##0' : '#,##0.0#'

/** "Semana 1 · 02 al 07 nov" (single day: "Semana 2 · 09 nov"). */
export const weekLabel = (index: number, from: string, to: string) => {
  const short = monthShort.format(atNoon(to)).replace('.', '')
  return from === to
    ? `Semana ${index} · ${dayHeader(to)} ${short}`
    : `Semana ${index} · ${dayHeader(from)} al ${dayHeader(to)} ${short}`
}

/**
 * Week key: the Sunday (YYYY-MM-DD) that opens the day's week. Weeks run
 * Sunday to Saturday like the client's calendar, so a Sunday with sales joins
 * the days that follow it instead of closing the previous week.
 */
export const weekStart = (day: string) => {
  const date = atNoon(day)
  const back = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - back)
  return date.toISOString().slice(0, 10)
}

export type DailyRow = {
  kind: 'day' | 'week'
  /** Date label for days, "Semana n · …" for week subtotals. */
  label: string
  day?: string
  /** Null for days after `through` (no data yet). */
  revenueCents: number | null
  marginCents: number | null
  /** Boxes sold; null for days after `through`. */
  boxes: number | null
  /** Day after `through`: nothing to show yet. */
  empty: boolean
  /** Period already over without a single sale: shown as "—", not zeros. */
  quiet: boolean
}

export type DailySheet = {
  columns: ['FECHA', 'VENTA DIARIA', 'GANANCIA DIARIA', 'CAJAS']
  rows: Array<DailyRow>
  total: {
    label: 'Total del mes'
    revenueCents: number
    marginCents: number
    boxes: number
  }
}

export function buildDailySheet(results: MonthlyResults): DailySheet {
  const rows: Array<DailyRow> = []
  let revenue = 0
  let margin = 0
  let week = 0
  let index = 0
  while (index < results.days.length) {
    const key = weekStart(results.days[index])
    let end = index
    while (
      end + 1 < results.days.length &&
      weekStart(results.days[end + 1]) === key
    ) {
      end += 1
    }
    week += 1
    let weekRevenue = 0
    let weekMargin = 0
    let weekBoxes = 0
    let weekOrders = 0
    let weekHasData = false
    for (let at = index; at <= end; at += 1) {
      const date = results.days[at]
      const data = results.byDay[at]
      const empty = date > results.through
      if (!empty) {
        weekHasData = true
        weekRevenue += data.revenueCents
        weekMargin += data.marginCents
        weekBoxes += data.boxes
        weekOrders += data.orders
      }
      rows.push({
        kind: 'day',
        label: longDateLabel(date),
        day: date,
        revenueCents: empty ? null : data.revenueCents,
        marginCents: empty ? null : data.marginCents,
        boxes: empty ? null : data.boxes,
        empty,
        quiet: !empty && data.orders === 0,
      })
    }
    rows.push({
      kind: 'week',
      label: weekLabel(week, results.days[index], results.days[end]),
      // A week that has not started has no subtotal, not a $0.00 one.
      revenueCents: weekHasData ? weekRevenue : null,
      marginCents: weekHasData ? weekMargin : null,
      boxes: weekHasData ? twoDecimals(weekBoxes) : null,
      empty: !weekHasData,
      quiet: weekHasData && weekOrders === 0,
    })
    revenue += weekRevenue
    margin += weekMargin
    index = end + 1
  }
  return {
    columns: ['FECHA', 'VENTA DIARIA', 'GANANCIA DIARIA', 'CAJAS'],
    rows,
    total: {
      label: 'Total del mes',
      revenueCents: revenue,
      marginCents: margin,
      // The month's own total (as the KPI), not the sum of rounded days.
      boxes: results.totals.boxes,
    },
  }
}

/**
 * The one rule for days without figures, in Excel and PDF: a past day or week
 * without sales prints "—"; one that has not happened yet stays blank.
 */
export const noSalesMark = '—'

/** Label, venta, ganancia and cajas of a daily row, as printed. */
export function dailyRowCells(row: DailyRow): [string, string, string, string] {
  if (row.empty) return [row.label, '', '', '']
  if (row.quiet) return [row.label, noSalesMark, noSalesMark, noSalesMark]
  return [
    row.label,
    moneyLabel(row.revenueCents ?? 0),
    moneyLabel(row.marginCents ?? 0),
    boxesLabel(row.boxes ?? 0),
  ]
}

export type BoxesRow = {
  productId: string
  name: string
  /** Name of the box presentation, e.g. "Caja 12". */
  boxName: string
  /** One entry per day column; null = nothing sold (or no data yet). */
  boxesByDay: Array<number | null>
  boxes: number
  marginPerBoxCents: number | null
  marginCents: number
}

export type BoxesSheet = {
  /** "02", "03"… one per day column. */
  dayHeaders: Array<string>
  /** True for columns after `through`: left blank. */
  futureDays: Array<boolean>
  productHeader: 'PRODUCTO'
  totalHeaders: ['TOTAL CAJAS', 'GANANCIA X CAJA', 'GANANCIA']
  rows: Array<BoxesRow>
  /** Boxes sold per day column, all products. */
  dayTotals: Array<number>
  totalBoxes: number
  totalMarginCents: number
}

const boxesRow = (
  product: MonthlyProductRow,
  days: Array<string>,
  through: string,
): BoxesRow => ({
  productId: product.productId,
  name: product.name,
  boxName: product.boxName,
  boxesByDay: days.map((date) =>
    date > through ? null : (product.boxesByDay[date] ?? null),
  ),
  boxes: product.boxes,
  marginPerBoxCents: product.marginPerBoxCents,
  marginCents: product.marginCents,
})

/** True when the product sold something in the month. */
export const wasSold = (product: MonthlyProductRow) =>
  product.boxes > 0 || product.revenueCents !== 0

/**
 * Product × day grid in catalog order (`position`). `unsold: false` leaves
 * out products without sales; totals are unaffected since those add zero.
 */
export function buildBoxesSheet(
  results: MonthlyResults,
  options: { unsold?: boolean } = {},
): BoxesSheet {
  const { unsold = true } = options
  const rows = results.products
    .filter((product) => unsold || wasSold(product))
    .sort((a, b) => a.position - b.position)
    .map((product) => boxesRow(product, results.days, results.through))
  return {
    dayHeaders: results.days.map(dayHeader),
    futureDays: results.days.map((date) => date > results.through),
    productHeader: 'PRODUCTO',
    totalHeaders: ['TOTAL CAJAS', 'GANANCIA X CAJA', 'GANANCIA'],
    rows,
    dayTotals: results.days.map((_, column) =>
      rows.reduce((sum, row) => sum + (row.boxesByDay[column] ?? 0), 0),
    ),
    totalBoxes: results.totals.boxes,
    totalMarginCents: rows.reduce((sum, row) => sum + row.marginCents, 0),
  }
}

export const dailySheetName = 'Venta y ganancia por día'
export const boxesSheetName = 'Cajas por producto'

/** Download filename: resultados-YYYY-MM.<ext>. */
export const monthlyFilename = (month: string, extension: 'xlsx' | 'pdf') =>
  `resultados-${month}.${extension}`

/** ventas-diarias-YYYY-MM.xlsx: the daily sale and margin file. */
export const dailyFilename = (month: string) => `ventas-diarias-${month}.xlsx`

/** cajas-por-producto-YYYY-MM.xlsx: the boxes by product file. */
export const boxesFilename = (month: string) =>
  `cajas-por-producto-${month}.xlsx`

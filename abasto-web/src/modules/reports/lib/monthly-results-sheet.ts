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

/** Boxes with up to two decimals: 12.5 → "12.5". */
export const boxesLabel = (boxes: number) =>
  String(Math.round(boxes * 100) / 100)

/** "Semana 1 · 02 al 07 nov" (single day: "Semana 2 · 09 nov"). */
export const weekLabel = (index: number, from: string, to: string) => {
  const short = monthShort.format(atNoon(to)).replace('.', '')
  return from === to
    ? `Semana ${index} · ${dayHeader(to)} ${short}`
    : `Semana ${index} · ${dayHeader(from)} al ${dayHeader(to)} ${short}`
}

/** Monday-based week key: the Monday (YYYY-MM-DD) of the day's week. */
const weekStart = (day: string) => {
  const date = atNoon(day)
  const back = (date.getUTCDay() + 6) % 7
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
  empty: boolean
}

export type DailySheet = {
  columns: ['FECHA', 'VENTA DIARIA', 'GANANCIA DIARIA']
  rows: Array<DailyRow>
  total: {
    label: 'Total de ganancia'
    revenueCents: number
    marginCents: number
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
    for (let at = index; at <= end; at += 1) {
      const date = results.days[at]
      const data = results.byDay[at]
      const empty = date > results.through
      if (!empty) {
        weekRevenue += data.revenueCents
        weekMargin += data.marginCents
      }
      rows.push({
        kind: 'day',
        label: longDateLabel(date),
        day: date,
        revenueCents: empty ? null : data.revenueCents,
        marginCents: empty ? null : data.marginCents,
        empty,
      })
    }
    rows.push({
      kind: 'week',
      label: weekLabel(week, results.days[index], results.days[end]),
      revenueCents: weekRevenue,
      marginCents: weekMargin,
      empty: false,
    })
    revenue += weekRevenue
    margin += weekMargin
    index = end + 1
  }
  return {
    columns: ['FECHA', 'VENTA DIARIA', 'GANANCIA DIARIA'],
    rows,
    total: {
      label: 'Total de ganancia',
      revenueCents: revenue,
      marginCents: margin,
    },
  }
}

export type BoxesRow = {
  name: string
  /** One entry per day column; null = nothing sold (or no data yet). */
  boxesByDay: Array<number | null>
  boxes: number
  marginPerBoxCents: number | null
  marginCents: number
}

export type BoxesSheet = {
  /** "02", "03"… one per day column. */
  dayHeaders: Array<string>
  /** True for columns after `through`: shown as "—". */
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
  name: product.name,
  boxesByDay: days.map((date) =>
    date > through ? null : (product.boxesByDay[date] ?? null),
  ),
  boxes: product.boxes,
  marginPerBoxCents: product.marginPerBoxCents,
  marginCents: product.marginCents,
})

export function buildBoxesSheet(results: MonthlyResults): BoxesSheet {
  const rows = results.products.map((product) =>
    boxesRow(product, results.days, results.through),
  )
  return {
    dayHeaders: results.days.map(dayHeader),
    futureDays: results.days.map((date) => date > results.through),
    productHeader: 'PRODUCTO',
    totalHeaders: ['TOTAL CAJAS', 'GANANCIA X CAJA', 'GANANCIA'],
    rows,
    dayTotals: results.days.map((_, column) =>
      rows.reduce((sum, row) => sum + (row.boxesByDay[column] ?? 0), 0),
    ),
    totalBoxes: rows.reduce((sum, row) => sum + row.boxes, 0),
    totalMarginCents: rows.reduce((sum, row) => sum + row.marginCents, 0),
  }
}

export const dailySheetName = 'Venta y ganancia por día'
export const boxesSheetName = 'Cajas por producto'

/** Download filename: resultados-YYYY-MM.<ext>. */
export const monthlyFilename = (month: string, extension: 'xlsx' | 'pdf') =>
  `resultados-${month}.${extension}`

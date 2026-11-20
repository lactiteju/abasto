/** Pure scales, ordering and labels behind the monthly charts and product list. */
import { formatCents } from '#/modules/pricing/lib/money'
import { wasSold } from '#/modules/reports/lib/monthly-results-sheet'
import type { MonthlyProductRow } from '#/modules/reports/types/monthly-results'

/** Round steps (×10ⁿ) tried for an axis, smallest first. */
const steps = [1, 2, 2.5, 5, 10]

/** Axis ticks from 0 up to a round top ≥ `max`: [0, 50, 100], top 100. */
export function niceTicks(max: number, wanted = 4) {
  if (!(max > 0)) return { ticks: [0, 1], top: 1 }
  const raw = max / wanted
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = (steps.find((item) => item * power >= raw) ?? 10) * power
  const top = Math.ceil(max / step) * step
  const ticks: Array<number> = []
  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6)
  }
  return { ticks, top }
}

/** Compact pesos for axes: "$800", "$50 mil", "$12.5 mil", "$1.2 M". */
export function compactPesos(cents: number) {
  const pesos = Math.abs(cents) / 100
  const sign = cents < 0 ? '-' : ''
  const trim = (value: number) => String(Math.round(value * 10) / 10)
  if (pesos >= 1_000_000) return `${sign}$${trim(pesos / 1_000_000)} M`
  if (pesos >= 1_000) return `${sign}$${trim(pesos / 1_000)} mil`
  return `${sign}$${trim(pesos)}`
}

export type ProductSort = 'mas' | 'menos' | 'ganancia' | 'sin'
export type ProductMetric = 'pesos' | 'cajas'

export const sortLabels: Array<{ value: ProductSort; label: string }> = [
  { value: 'mas', label: 'Más vendidos' },
  { value: 'menos', label: 'Menos vendidos' },
  { value: 'ganancia', label: 'Mayor ganancia' },
  { value: 'sin', label: 'Sin venta' },
]

/** Number each product is measured by in the list. */
export const figureOf = (
  product: MonthlyProductRow,
  sort: ProductSort,
  metric: ProductMetric,
) =>
  metric === 'cajas'
    ? product.boxes
    : sort === 'ganancia'
      ? product.marginCents
      : product.revenueCents

/** Products of one chip; ties fall back to catalog order. */
export function listProducts(
  products: Array<MonthlyProductRow>,
  sort: ProductSort,
  metric: ProductMetric,
) {
  const byCatalog = (a: MonthlyProductRow, b: MonthlyProductRow) =>
    a.position - b.position
  if (sort === 'sin') {
    return products.filter((product) => !wasSold(product)).sort(byCatalog)
  }
  const sold = products.filter(wasSold)
  const order = sort === 'menos' ? 1 : -1
  return sold.sort(
    (a, b) =>
      order * (figureOf(a, sort, metric) - figureOf(b, sort, metric)) ||
      byCatalog(a, b),
  )
}

/** Bar length in percent of the longest one; at least 2 when there is a figure. */
export const barShare = (figure: number, max: number) =>
  figure > 0 && max > 0 ? Math.max(2, Math.round((figure / max) * 100)) : 0

export const pesosCents = (cents: number) => formatCents(cents)

/** "18.2 %" from a percent number. */
export const percentText = (pct: number) => `${pct.toFixed(1)} %`

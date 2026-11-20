/**
 * "Resultados del mes": the client's monthly sheet. Money is integer cents;
 * days are business dates (America/Mexico_City), YYYY-MM-DD.
 */
import type {
  ReportSupplier,
  ReportWarehouse,
} from '#/modules/reports/types/reports'

/** Sale, cost and margin of one business day; zeros when nothing was sold. */
export type MonthlyDay = {
  day: string
  orders: number
  revenueCents: number
  costCents: number
  marginCents: number
  /** Boxes sold that day, all products (fractional when loose pieces sold). */
  boxes: number
}

/** One product of the month, with the boxes it sold on each day. */
export type MonthlyProductRow = {
  productId: string
  name: string
  sku: string
  /**
   * Base units on hand today in the report scope (selected warehouse(s));
   * 0 when none. The boxes export lists products with stock or sales.
   */
  stockUnits: number
  /** Catalog order (name, then SKU) among the products of the sheet, 0-based. */
  position: number
  /** Name of the presentation counted as "caja", e.g. "Caja 12". */
  boxName: string
  /** Base units in one box; 1 when the product has no box presentation. */
  boxFactor: number
  /** Day → boxes sold; days without sales are absent. */
  boxesByDay: Record<string, number>
  boxes: number
  revenueCents: number
  costCents: number
  marginCents: number
  /** Margin ÷ boxes, rounded; null when no box was sold. */
  marginPerBoxCents: number | null
}

export type MonthlyTotals = {
  orders: number
  revenueCents: number
  costCents: number
  marginCents: number
  boxes: number
}

export type MonthlyResults = {
  /** YYYY-MM. */
  month: string
  /** First and last calendar day of the month. */
  range: { from: string; to: string }
  /** Last day that can have data: today inside the current month, else range.to. */
  through: string
  /**
   * Days shown as columns and rows: Monday to Saturday of the month, plus any
   * Sunday that had sales. Ascending.
   */
  days: Array<string>
  /** One entry per `days` item, same order. */
  byDay: Array<MonthlyDay>
  /**
   * Every active product in scope (unsold ones with zeros), sorted by margin
   * (highest first), then by `position`.
   */
  products: Array<MonthlyProductRow>
  totals: MonthlyTotals
  /** Same totals for the previous calendar month, whole month. */
  previous: MonthlyTotals
}

export type MonthlyResultsLoad = {
  warehouses: Array<ReportWarehouse>
  suppliers: Array<ReportSupplier>
  data?: MonthlyResults
  error?: string
}

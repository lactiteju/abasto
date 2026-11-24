/**
 * "Repartos": the weekly report of the riders of one warehouse. Money is
 * integer cents; days are business dates (America/Mexico_City), YYYY-MM-DD.
 */
import type {
  ReportSupplier,
  ReportWarehouse,
} from '#/modules/reports/types/reports'

/** What one rider moved of one product on one business day (settled deliveries). */
export type RiderWeeklyCell = {
  day: string
  riderId: string
  productId: string
  /** Pieces sold (merma excluded). */
  units: number
  /** Sale at the prices frozen on the delivery. */
  revenueCents: number
  /** Real cost of the lots the sold pieces came from. */
  costCents: number
  /** Damaged pieces: neither sold nor returned. */
  scrapUnits: number
  /** Route pay owed for the sold pieces (frozen per box, prorated, rounded per line). */
  routePayCents: number
}

export type RiderWeeklyRider = { id: string; name: string }

export type RiderWeeklyProduct = {
  productId: string
  sku: string
  name: string
  /** Pieces per box when delivered. */
  boxFactor: number
  /** Route pay per box frozen on the deliveries of the week (the highest if it changed). */
  routePayPerBoxCents: number
  /** Frozen price of one loose piece (the highest if it changed). */
  pieceCents: number
}

export type RiderWeeklyReport = {
  /** Monday, YYYY-MM-DD. */
  weekStart: string
  /** Monday to Sunday. */
  days: Array<string>
  warehouse: ReportWarehouse
  /** Supplier filter in effect; null means every supplier. */
  supplier: ReportSupplier | null
  /** Riders with activity in the week plus the warehouse's active riders, by name. */
  riders: Array<RiderWeeklyRider>
  /** Products with sales or merma in the week, in catalog order. */
  products: Array<RiderWeeklyProduct>
  /** Only combinations with activity. */
  cells: Array<RiderWeeklyCell>
}

export type RiderWeeklyLoad = {
  warehouses: Array<ReportWarehouse>
  suppliers: Array<ReportSupplier>
  /** Resolved scope (defaults applied); absent when the request was refused. */
  warehouseId?: string
  /** Null means every supplier. */
  supplierId?: string | null
  data?: RiderWeeklyReport
  error?: string
}

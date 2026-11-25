import { businessDate } from '#/lib/utils/format'
import { normalize } from '#/modules/inventory/lib/format'

/** Pieces of a product that are on the shelf: not held by orders nor handed to riders. */
export const freePieces = (row: {
  onHand: number
  reserved: number
  inRoute: number
}) => Math.max(0, row.onHand - row.reserved - row.inRoute)

export type LossKind = 'dañado' | 'caducado' | 'reparto' | 'otro'

export type LossMotive = { kind: LossKind; label: string; detail: string }

/** Reads a `loss` movement's reason: «<categoría>» or «<categoría>: <motivo>». */
export function lossMotive(reason: string): LossMotive {
  const text = reason.trim()
  const match = /^(dañado|caducado|otro)\s*(?::\s*(.*))?$/i.exec(text)
  if (!match) return { kind: 'otro', label: text || 'Otro', detail: '' }
  const category = match[1].toLowerCase() as 'dañado' | 'caducado' | 'otro'
  const note = (match.at(2) ?? '').trim()
  if (category === 'otro') {
    return { kind: 'otro', label: note || 'Otro', detail: '' }
  }
  const label = category === 'dañado' ? 'Dañado' : 'Caducado'
  if (/^reparto\s/i.test(note)) {
    return { kind: 'reparto', label: note, detail: label }
  }
  return { kind: category, label, detail: note }
}

/** Cost of the lost pieces: the lot's cost spread evenly over its received pieces. */
export const lossCostCents = (
  pieces: number,
  receivedQuantity: number,
  receivedCostCents: number,
) =>
  receivedQuantity > 0
    ? Math.round((pieces * receivedCostCents) / receivedQuantity)
    : 0

export type LossPeriod = 'week' | 'month' | 'all'

export const lossPeriods: ReadonlyArray<{ value: LossPeriod; label: string }> =
  [
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'all', label: 'Todo el historial' },
  ]

/** First business day (YYYY-MM-DD) a period includes; null when open-ended. */
export function lossPeriodStart(
  period: LossPeriod,
  today: string,
): string | null {
  if (period === 'all') return null
  if (period === 'month') return `${today.slice(0, 8)}01`
  const date = new Date(`${today}T12:00:00Z`)
  const sinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - sinceMonday)
  return date.toISOString().slice(0, 10)
}

/** What the Mermas tab needs of a loss movement and its product. */
export type LossRow = {
  id: string
  productName: string
  sku: string
  /** Positive pieces taken out. */
  quantity: number
  reason: string
  createdAt: Date | string
  /** Cost of the lost pieces; null when unknown or hidden. */
  costCents: number | null
}

export type LossFilters = { query: string; motive: string; period: LossPeriod }

export const lossMotiveFilters: ReadonlyArray<{
  value: string
  label: string
}> = [
  { value: 'Todos', label: 'Todos los motivos' },
  { value: 'dañado', label: 'Dañado' },
  { value: 'caducado', label: 'Caducado' },
  { value: 'reparto', label: 'Reparto' },
  { value: 'otro', label: 'Otro' },
]

export function filterLosses<T extends LossRow>(
  rows: ReadonlyArray<T>,
  { query, motive, period }: LossFilters,
  today: string,
): Array<T> {
  const needle = normalize(query.trim())
  const since = lossPeriodStart(period, today)
  return rows.filter((row) => {
    if (motive !== 'Todos' && lossMotive(row.reason).kind !== motive) {
      return false
    }
    if (since && businessDate(new Date(row.createdAt)) < since) return false
    return (
      !needle || normalize(`${row.productName} ${row.sku}`).includes(needle)
    )
  })
}

/** Pieces and known cost of the rows; `hasCost` is false when no row has a cost. */
export function lossTotals(rows: ReadonlyArray<LossRow>) {
  return rows.reduce(
    (total, row) => ({
      pieces: total.pieces + row.quantity,
      costCents: total.costCents + (row.costCents ?? 0),
      hasCost: total.hasCost || row.costCents !== null,
    }),
    { pieces: 0, costCents: 0, hasCost: false },
  )
}

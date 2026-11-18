import { formatNoteDate } from '#/modules/counter/lib/remission-note'
import type {
  RemissionNote,
  RemissionNoteMeta,
} from '#/modules/counter/lib/remission-note'
import { formatCents } from '#/modules/pricing/lib/money'
import { priceSold } from '#/modules/riders/lib/allocation-pricing'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

/** "REP-3F2A9C1E": the first 8 characters of the assignment id. */
export const assignmentCode = (id: string) =>
  `REP-${id.slice(0, 8).toUpperCase()}`

const sum = (values: ReadonlyArray<number>) =>
  values.reduce((total, value) => total + value, 0)

/** Rounded unit price of a group; the importe stays the exact figure. */
const unitCents = (cents: number, units: number) => Math.round(cents / units)

/**
 * Rows of one sold line: whole boxes (at the frozen box price) and loose
 * pieces (at the piece price), the way the settlement priced them. Importes
 * add up to what the settlement charged for the line.
 */
function lineRows(line: AssignmentDetail['lines'][number]): {
  rows: Array<Array<string>>
  cents: number
} {
  const sold = line.soldQuantity ?? 0
  if (sold < 1) return { rows: [], cents: 0 }
  const total = sum(priceSold(line.allocations, sold).map((p) => p.cents))
  const boxes = line.boxFactor > 1 ? Math.floor(sold / line.boxFactor) : 0
  const pieces = sold - boxes * line.boxFactor
  const boxesCents = sum(
    priceSold(line.allocations, boxes * line.boxFactor).map((p) => p.cents),
  )
  const piecesCents = total - boxesCents
  const rows: Array<Array<string>> = []
  if (boxes > 0) {
    rows.push([
      String(boxes),
      `${line.productName} (caja de ${line.boxFactor})`,
      formatCents(unitCents(boxesCents, boxes)),
      formatCents(boxesCents),
    ])
  }
  if (pieces > 0) {
    rows.push([
      String(pieces),
      line.boxFactor > 1 ? `${line.productName} (pieza)` : line.productName,
      formatCents(unitCents(piecesCents, pieces)),
      formatCents(piecesCents),
    ])
  }
  return { rows, cents: total }
}

/**
 * The «Nota de remisión» of a settled assignment: what the rider sold (assigned
 * − leftover) at the frozen lot prices, the expected total, and, when the cash
 * handed in differs, «Entregado» and «Faltante»/«Sobrante». No layout, only text.
 */
export function buildSettlementNote(
  assignment: Pick<
    AssignmentDetail,
    | 'id'
    | 'riderName'
    | 'createdAt'
    | 'closedAt'
    | 'expectedCents'
    | 'deliveredCents'
    | 'lines'
  >,
  meta: RemissionNoteMeta,
): RemissionNote {
  const code = assignmentCode(assignment.id)
  const priced = assignment.lines.map(lineRows)
  const expected = assignment.expectedCents ?? sum(priced.map((l) => l.cents))
  const delivered = assignment.deliveredCents ?? expected
  const difference = delivered - expected
  return {
    business: meta.business,
    title: 'NOTA DE REMISIÓN',
    folio: code,
    date: formatNoteDate(assignment.closedAt ?? assignment.createdAt),
    customer: assignment.riderName,
    partyLabel: 'Repartidor',
    warehouse: meta.warehouseName,
    head: ['CANT.', 'ARTÍCULO', 'PRECIO', 'IMPORTE'],
    rows: priced.flatMap((l) => l.rows),
    totalLabel: 'TOTAL',
    total: formatCents(expected),
    extraTotals:
      difference === 0
        ? []
        : [
            ['Entregado', formatCents(delivered)],
            difference < 0
              ? ['Faltante', formatCents(-difference)]
              : ['Sobrante', formatCents(difference)],
          ],
    paidMark: 'LIQUIDADO',
    signature: 'Recibí de conformidad',
    filename: `nota-${code}.pdf`,
  }
}

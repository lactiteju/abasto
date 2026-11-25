import { orderCode } from '#/modules/counter/lib/order-format'
import { formatCents } from '#/modules/pricing/lib/money'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

export type RemissionNoteMeta = {
  business: string
  warehouseName: string
}

/** The note as plain strings, ready for any renderer. */
export type RemissionNote = {
  business: string
  title: string
  folio: string
  date: string
  /** Who the note is for: the customer, or the rider of a settlement. */
  customer: string
  /** Label of `customer` on the note; «Cliente» when omitted. */
  partyLabel?: string
  warehouse: string
  head: Array<string>
  rows: Array<Array<string>>
  totalLabel: string
  total: string
  /** Summary lines under the total, as [label, amount]. */
  extraTotals?: Array<[string, string]>
  paidMark: string
  signature: string
  filename: string
}

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'long',
  timeZone: 'America/Mexico_City',
})

/** «18 de noviembre de 2026», in the business time zone. */
export const formatNoteDate = (date: Date) => dateFormat.format(date)

const numericDate = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
})

/**
 * Download name of a note: «<cliente> <dd-mm-aaaa> <folio>.pdf», in the
 * business time zone, without the characters Windows refuses in file names.
 */
export function noteFilename(party: string, date: Date, code: string) {
  const name =
    party
      .replace(/\s*[\\/]\s*/g, ' - ')
      // eslint-disable-next-line no-control-regex
      .replace(/[:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
      .replace(/[\s.-]+$/, '') || 'nota'
  const day = numericDate.format(date).replace(/\//g, '-')
  return `${name} ${day} ${code}.pdf`
}

/** Builds the «Nota de remisión» of a picked-up order: no layout, only text. */
export function buildRemissionNote(
  order: Pick<
    OrderDetail,
    'id' | 'customerName' | 'totalCents' | 'createdAt' | 'closedAt' | 'lines'
  >,
  meta: RemissionNoteMeta,
): RemissionNote {
  const code = orderCode(order.id)
  const date = order.closedAt ?? order.createdAt
  return {
    business: meta.business,
    title: 'NOTA DE REMISIÓN',
    folio: code,
    date: dateFormat.format(date),
    customer: order.customerName,
    warehouse: meta.warehouseName,
    head: ['CANT.', 'ARTÍCULO', 'PRECIO', 'IMPORTE'],
    rows: order.lines.map((line) => [
      String(line.quantity),
      `${line.productName} ${line.presentationName}`,
      formatCents(line.unitPriceCents),
      formatCents(line.lineTotalCents),
    ]),
    totalLabel: 'TOTAL',
    total: formatCents(order.totalCents),
    paidMark: 'PAGADO',
    signature: 'Recibí de conformidad',
    filename: noteFilename(order.customerName, date, code),
  }
}

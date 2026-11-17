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
  customer: string
  warehouse: string
  head: Array<string>
  rows: Array<Array<string>>
  totalLabel: string
  total: string
  paidMark: string
  signature: string
  filename: string
}

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'long',
  timeZone: 'America/Mexico_City',
})

/** Builds the «Nota de remisión» of a picked-up order: no layout, only text. */
export function buildRemissionNote(
  order: Pick<
    OrderDetail,
    'id' | 'customerName' | 'totalCents' | 'createdAt' | 'closedAt' | 'lines'
  >,
  meta: RemissionNoteMeta,
): RemissionNote {
  const code = orderCode(order.id)
  return {
    business: meta.business,
    title: 'NOTA DE REMISIÓN',
    folio: code,
    date: dateFormat.format(order.closedAt ?? order.createdAt),
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
    filename: `nota-${code}.pdf`,
  }
}

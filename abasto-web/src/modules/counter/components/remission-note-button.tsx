import { ActionButton } from '#/modules/counter/components/action-button'
import { useRemissionNote } from '#/modules/counter/hooks/use-remission-note'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

/** «Nota PDF» of a picked-up order; fetches the detail unless `order` is given. */
export function RemissionNoteButton({
  orderId,
  order,
  warehouseName,
}: {
  orderId: string
  order?: OrderDetail
  warehouseName: string
}) {
  const note = useRemissionNote(warehouseName)
  return (
    <ActionButton
      disabled={note.pending}
      onClick={() => void note.download(orderId, order)}
    >
      {note.pending ? 'Generando…' : 'Nota PDF'}
    </ActionButton>
  )
}

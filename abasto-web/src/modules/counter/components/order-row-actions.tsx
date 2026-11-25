import { useState } from 'react'

import { RowActionsMenu } from '#/components/row-actions-menu'
import { ReopenSaleDialog } from '#/modules/counter/components/reopen-sale-button'
import { useOrderActions } from '#/modules/counter/hooks/use-order-actions'
import { useRemissionNote } from '#/modules/counter/hooks/use-remission-note'
import { orderCode } from '#/modules/counter/lib/order-format'
import { orderRowMenuItems } from '#/modules/counter/lib/order-row-menu'
import type { OrderSummary } from '#/modules/orders/services/order-reads'

type OrderRowActionsProps = {
  order: OrderSummary
  warehouseName: string
  canReopen: boolean
  onOpen: (orderId: string) => void
}

/**
 * The «⋯» menu of an order row (Ver pedido, Nota PDF, Editar venta) with the
 * «Editar venta» confirmation. Events stop here so they never reach the
 * clickable row that wraps it (React bubbles through portals too).
 */
export function OrderRowActions({
  order,
  warehouseName,
  canReopen,
  onOpen,
}: OrderRowActionsProps) {
  const note = useRemissionNote(warehouseName)
  const actions = useOrderActions()
  const [confirming, setConfirming] = useState(false)
  const reopenable = canReopen && order.status === 'Recogido'

  const items = orderRowMenuItems({
    status: order.status,
    canReopen,
    pdfPending: note.pending,
    reopenPending: actions.pending,
    onView: () => onOpen(order.id),
    onPdf: () => void note.download(order.id),
    onReopen: () => setConfirming(true),
  })

  return (
    <div
      className="inline-flex"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <RowActionsMenu
        label={`Acciones de ${orderCode(order.id)}`}
        items={items}
      />
      {reopenable && (
        <ReopenSaleDialog
          orderId={order.id}
          totalCents={order.totalCents}
          onReopened={(reopened) => onOpen(reopened.id)}
          open={confirming}
          onOpenChange={setConfirming}
          pending={actions.pending}
          reopen={actions.reopenSale}
        />
      )}
    </div>
  )
}

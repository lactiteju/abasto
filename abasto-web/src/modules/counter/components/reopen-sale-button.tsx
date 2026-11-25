import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { ActionButton } from '#/modules/counter/components/action-button'
import { useOrderActions } from '#/modules/counter/hooks/use-order-actions'
import { orderCode } from '#/modules/counter/lib/order-format'
import { formatCents } from '#/modules/pricing/lib/money'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

type ReopenSaleButtonProps = {
  orderId: string
  totalCents: number
  /** The order is Reservado again; open it for editing. */
  onReopened: (order: OrderDetail) => void
}

/** «Editar venta» (owner): confirms, then takes a delivered sale back to Reservado. */
export function ReopenSaleButton({
  orderId,
  totalCents,
  onReopened,
}: ReopenSaleButtonProps) {
  const actions = useOrderActions()
  const [open, setOpen] = useState(false)

  async function confirm() {
    const result = await actions.reopenSale(orderId)
    setOpen(false)
    if (result) onReopened(result.data)
  }

  return (
    <>
      <ActionButton disabled={actions.pending} onClick={() => setOpen(true)}>
        Editar venta
      </ActionButton>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent maximizable={false}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Editar esta venta? {orderCode(orderId)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se regresa a Reservado, el inventario vuelve a apartarse y{' '}
              {formatCents(totalCents)} sale de la caja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, volver</AlertDialogCancel>
            <ActionButton
              tone="primary"
              disabled={actions.pending}
              onClick={() => void confirm()}
            >
              Sí, editar venta
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

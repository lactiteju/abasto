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

/** Controlled «Editar venta» confirmation; the trigger lives wherever the caller wants. */
export function ReopenSaleDialog({
  orderId,
  totalCents,
  onReopened,
  open,
  onOpenChange,
  pending,
  reopen,
}: ReopenSaleButtonProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  reopen: (orderId: string) => Promise<{ data: OrderDetail } | undefined>
}) {
  async function confirm() {
    const result = await reopen(orderId)
    onOpenChange(false)
    if (result) onReopened(result.data)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            disabled={pending}
            onClick={() => void confirm()}
          >
            Sí, editar venta
          </ActionButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** «Editar venta» (owner): confirms, then takes a delivered sale back to Reservado. */
export function ReopenSaleButton(props: ReopenSaleButtonProps) {
  const actions = useOrderActions()
  const [open, setOpen] = useState(false)

  return (
    <>
      <ActionButton disabled={actions.pending} onClick={() => setOpen(true)}>
        Editar venta
      </ActionButton>
      <ReopenSaleDialog
        {...props}
        open={open}
        onOpenChange={setOpen}
        pending={actions.pending}
        reopen={actions.reopenSale}
      />
    </>
  )
}

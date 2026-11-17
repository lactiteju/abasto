import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { counterPickupFn } from '#/modules/counter/server/pickup'
import type { PickupWithReceipt } from '#/modules/counter/server/pickup'
import { counterSellFn } from '#/modules/counter/server/sell'
import type { PickupPayment } from '#/modules/orders/services/pickup-gate'
import { messageOf, useActionRunner } from '#/hooks/use-action-runner'
import { unwrap } from '#/lib/boundary'
import type { OrderInput } from '#/modules/counter/lib/order-draft'
import {
  addToOrderFn,
  cancelOrderFn,
  createOrderFn,
  editOrderFn,
  orderDetailFn,
  setReservationHoursFn,
} from '#/modules/orders/server/orders'

/**
 * Write actions of Mostrador. Each resolves to `{ data }` on success (the list
 * reloads and a Spanish toast confirms) or to `undefined` after showing the
 * server message as a toast. `pending` is true while one is saving.
 */
export function useOrderActions() {
  const router = useRouter()
  const run = useActionRunner()

  return {
    pending: run.pending,
    createOrder: (input: OrderInput) =>
      run(() => createOrderFn({ data: input }), 'Pedido reservado.'),
    /**
     * Delivers the order with its payment. The refusal message comes back to
     * the payment step (no toast) so it can sit next to what to do about it.
     */
    pickup: async (
      orderId: string,
      payment: PickupPayment,
    ): Promise<
      { ok: true; data: PickupWithReceipt } | { ok: false; message: string }
    > => {
      try {
        const data = unwrap(
          await counterPickupFn({ data: { orderId, payment } }),
        )
        await router.invalidate()
        toast.success('Pedido entregado.')
        return { ok: true, data }
      } catch (failure) {
        await router.invalidate()
        return { ok: false, message: messageOf(failure) }
      }
    },
    /**
     * Creates the order and delivers it paid in one step. Like `pickup`, the
     * refusal comes back to the payment step instead of a toast.
     */
    sell: async (
      order: OrderInput,
      payment: PickupPayment,
      expectedTotalCents: number,
    ): Promise<
      { ok: true; data: PickupWithReceipt } | { ok: false; message: string }
    > => {
      try {
        const data = unwrap(
          await counterSellFn({
            data: { ...order, expectedTotalCents, payment },
          }),
        )
        await router.invalidate()
        toast.success('Venta registrada.')
        return { ok: true, data }
      } catch (failure) {
        await router.invalidate()
        return { ok: false, message: messageOf(failure) }
      }
    },
    addToOrder: (
      orderId: string,
      lines: Array<{ presentationId: string; quantity: number }>,
    ) =>
      run(
        () => addToOrderFn({ data: { orderId, lines } }),
        'Pedido actualizado.',
      ),
    /** `changes` are the new totals of lines in the order (0 removes); `add` the units to add. */
    editOrder: (
      orderId: string,
      changes: Array<{ presentationId: string; quantity: number }>,
      add: Array<{ presentationId: string; quantity: number }>,
    ) =>
      run(
        () => editOrderFn({ data: { orderId, changes, add } }),
        'Pedido actualizado.',
      ),
    cancel: (orderId: string) =>
      run(() => cancelOrderFn({ data: { orderId } }), 'Pedido cancelado.'),
    setHours: (hours: number) =>
      run(
        () => setReservationHoursFn({ data: { hours } }),
        'Duración de la reserva guardada.',
      ),
    detail: async (orderId: string) =>
      unwrap(await orderDetailFn({ data: { orderId } })),
  }
}

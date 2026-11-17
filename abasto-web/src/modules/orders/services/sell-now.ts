import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { orders } from '#/modules/orders/db/schema'
import { deliverInTx } from '#/modules/orders/services/order-actions'
import type { PickupResult } from '#/modules/orders/services/order-actions'
import { formatCents } from '#/modules/pricing/lib/money'
import { validateLines } from '#/modules/orders/services/order-quotes'
import { readOrder } from '#/modules/orders/services/order-reads'
import { placeOrderInTx } from '#/modules/orders/services/orders'
import type { CreateOrderInput } from '#/modules/orders/services/orders'
import type { PickupPayment } from '#/modules/orders/services/pickup-gate'

/** A counter sale: the order plus the total the cashier saw when charging. */
export type SellInput = CreateOrderInput & { expectedTotalCents: number }

/**
 * Counter sale in one step: creates the order for the customer (same pricing,
 * customer rules and FIFO lot allocation as reserving) and delivers it paid in
 * cash, all in one transaction. The lots lose the units like a pickup; any
 * refusal (inactive customer, short stock, closed drawer, bad payment) rolls
 * everything back, so no order, reservation or movement is left behind.
 * If the total quoted here differs from `expectedTotalCents` (a price or a
 * lot-priced first lot changed since the cashier's quote) the sale is refused
 * with the new total, so the change shown is never computed on a stale total.
 * Locks follow create and pickup: warehouse stock first, then lots, then the
 * cash session.
 */
export async function sellNow(
  actor: Actor,
  input: SellInput,
  payment: PickupPayment | undefined,
): Promise<PickupResult> {
  authorize(actor, 'warehouse.operate', input.warehouseId)
  validateLines(input.lines)
  const { expectedTotalCents, ...order } = input
  return db.transaction(async (tx) => {
    const orderId = await placeOrderInTx(
      tx,
      { createdBy: actor.userId, source: 'counter' },
      order,
    )
    const placed = (
      await tx.select().from(orders).where(eq(orders.id, orderId))
    )[0]
    if (placed.totalCents !== expectedTotalCents) {
      throw new AppError(
        'conflict',
        `El total cambió a ${formatCents(placed.totalCents)}. Revisa el cobro.`,
      )
    }
    const receipt = await deliverInTx(tx, placed, payment, actor.userId)
    return { ...(await readOrder(tx, orderId)), payment: receipt }
  })
}

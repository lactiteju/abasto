import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { orders } from '#/modules/orders/db/schema'
import { deliverInTx } from '#/modules/orders/services/order-actions'
import type { PickupResult } from '#/modules/orders/services/order-actions'
import { validateLines } from '#/modules/orders/services/order-quotes'
import { readOrder } from '#/modules/orders/services/order-reads'
import { placeOrderInTx } from '#/modules/orders/services/orders'
import type { CreateOrderInput } from '#/modules/orders/services/orders'
import type { PickupPayment } from '#/modules/orders/services/pickup-gate'

/**
 * Counter sale in one step: creates the order for the customer (same pricing,
 * customer rules and FIFO lot allocation as reserving) and delivers it paid in
 * cash, all in one transaction. The lots lose the units like a pickup; any
 * refusal (inactive customer, short stock, closed drawer, bad payment) rolls
 * everything back, so no order, reservation or movement is left behind.
 * Locks follow create and pickup: warehouse stock first, then lots, then the
 * cash session.
 */
export async function sellNow(
  actor: Actor,
  input: CreateOrderInput,
  payment: PickupPayment | undefined,
): Promise<PickupResult> {
  authorize(actor, 'warehouse.operate', input.warehouseId)
  validateLines(input.lines)
  return db.transaction(async (tx) => {
    const orderId = await placeOrderInTx(
      tx,
      { createdBy: actor.userId, source: 'counter' },
      input,
    )
    const order = (
      await tx.select().from(orders).where(eq(orders.id, orderId))
    )[0]
    const receipt = await deliverInTx(tx, order, payment, actor.userId)
    return { ...(await readOrder(tx, orderId)), payment: receipt }
  })
}

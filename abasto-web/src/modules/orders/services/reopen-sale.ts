import { and, eq, sql } from 'drizzle-orm'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { cashMovements } from '#/modules/cash/db/schema'
import {
  lockOpenSession,
  postCashMovement,
} from '#/modules/cash/services/cash-ledger'
import { appendMovement } from '#/modules/inventory/services/stock-ledger'
import type { Tx } from '#/modules/inventory/services/stock-ledger'
import { orders } from '#/modules/orders/db/schema'
import { now } from '#/modules/orders/services/clock'
import { transition } from '#/modules/orders/services/order-actions'
import {
  allocationsOf,
  lockLotsInOrder,
} from '#/modules/orders/services/reservations'
import { readReservationHours } from '#/modules/orders/services/reservation-settings'

type Order = typeof orders.$inferSelect

const drawerClosed = () =>
  new AppError('conflict', 'Abre la caja para reabrir la venta.')

/** Cash that entered the drawer for the order's current delivery (its `sale` movement). */
async function cashCollected(tx: Tx, order: Order): Promise<number> {
  const [row] = await tx
    .select({
      total: sql<string>`coalesce(sum(${cashMovements.amountCents}), 0)::bigint`,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.orderId, order.id),
        eq(cashMovements.type, 'sale'),
        eq(cashMovements.saleCycle, order.reopenCount),
      ),
    )
  return Number(row.total)
}

/**
 * Takes a delivered sale back inside the caller's transaction (warehouse stock
 * lock already taken): the cash that entered the drawer for it leaves today's
 * open drawer as a withdrawal, every allocation returns to its lot as a
 * reserved unit (on hand and reserved rise together, one `sale` movement per
 * allocation with a positive quantity) and the order goes back to Reservado
 * with a fresh reservation window, so expiry does not release it at once.
 * Orders are paid in cash only, so there is no customer credit to reopen.
 */
async function reopenInTx(tx: Tx, order: Order, actorId: string) {
  const session = await lockOpenSession(tx, order.warehouseId, drawerClosed)
  const collected = await cashCollected(tx, order)
  const code = `PED-${order.id.slice(0, 8).toUpperCase()}`
  if (collected > 0) {
    await postCashMovement(tx, session, {
      type: 'withdrawal',
      amountCents: -collected,
      reason: `Venta reabierta ${code}`,
      orderId: order.id,
      customerId: order.customerId,
      actorId,
    })
  }
  const allocations = await allocationsOf(tx, order.id)
  const locked = await lockLotsInOrder(
    tx,
    allocations.map((a) => a.lotId),
  )
  for (const { lotId, quantity } of allocations) {
    await appendMovement(
      tx,
      locked.get(lotId)!,
      {
        type: 'sale',
        quantity,
        reason: 'Venta reabierta',
        reference: order.id,
        actorId,
      },
      { fromReserved: true },
    )
  }
  const at = now()
  const hours = await readReservationHours(tx)
  await tx
    .update(orders)
    .set({
      status: 'Reservado',
      closedAt: null,
      expiresAt: new Date(at.getTime() + hours * 3_600_000),
      reopenCount: order.reopenCount + 1,
      reopenedAt: at,
      reopenedBy: actorId,
    })
    .where(eq(orders.id, order.id))
}

/**
 * Recogido → Reservado, owner only: the sale is taken back so it can be
 * edited and delivered (and charged) again. Needs the warehouse drawer open.
 */
export const reopenSale = (actor: Actor, orderId: string) =>
  transition(
    () => authorize(actor, 'sales.reopen'),
    orderId,
    ['Recogido'],
    'Solo se puede reabrir una venta ya entregada.',
    (tx, order) => reopenInTx(tx, order, actor.userId),
  )

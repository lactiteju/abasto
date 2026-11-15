import { and, eq } from 'drizzle-orm'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { fitsInt4 } from '#/modules/inventory/services/stock-ledger'
import {
  orderAllocations,
  orderLines,
  orders,
} from '#/modules/orders/db/schema'
import { transition } from '#/modules/orders/services/order-actions'
import { reserveAllocations } from '#/modules/orders/services/order-allocation'
import {
  quoteLines,
  validateLines,
} from '#/modules/orders/services/order-quotes'
import type { OrderLineInput } from '#/modules/orders/services/order-quotes'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

export type AddToOrderInput = {
  orderId: string
  /** Units to ADD, in the presentation: raises the line of that presentation or opens a new one. */
  lines: Array<OrderLineInput>
}

const tooLarge = () =>
  new AppError('invalid', 'La cantidad del pedido es demasiado grande.')

/**
 * Raises a Reservado, unexpired order: the added units are priced and reserved
 * FIFO like a new order's. A presentation already in the order keeps its
 * frozen unit price for the added units (a line has one price); a new one is
 * quoted at the current price and the customer's rule. The total is
 * recomputed. One transaction: any shortage leaves the order untouched.
 */
export async function addToReservedOrder(
  actor: Actor,
  input: AddToOrderInput,
): Promise<OrderDetail> {
  validateLines(input.lines)
  return transition(
    (head) => authorize(actor, 'warehouse.operate', head.warehouseId),
    input.orderId,
    ['Reservado'],
    'Solo se puede editar un pedido reservado.',
    async (tx, order) => {
      const quotes = await quoteLines(tx, order, input.lines)
      const allocations = await reserveAllocations(tx, quotes)
      const existing = await tx
        .select()
        .from(orderLines)
        .where(eq(orderLines.orderId, order.id))
      const lineOf = new Map(existing.map((l) => [l.presentationId, l]))
      for (const [index, quote] of quotes.entries()) {
        const current = lineOf.get(quote.presentationId)
        let lineId: string
        if (current) {
          lineId = current.id
          const quantity = current.quantity + quote.quantity
          const baseQuantity = current.baseQuantity + quote.baseQuantity
          const lineTotalCents = current.unitPriceCents * quantity
          if (!fitsInt4(baseQuantity) || !fitsInt4(lineTotalCents)) {
            throw tooLarge()
          }
          await tx
            .update(orderLines)
            .set({ quantity, baseQuantity, lineTotalCents })
            .where(eq(orderLines.id, current.id))
          current.quantity = quantity
          current.lineTotalCents = lineTotalCents
        } else {
          const [created] = await tx
            .insert(orderLines)
            .values({
              orderId: order.id,
              productId: quote.productId,
              presentationId: quote.presentationId,
              quantity: quote.quantity,
              baseQuantity: quote.baseQuantity,
              listPriceCents: quote.listPriceCents,
              ruleMinQuantity: quote.rule?.minQuantity ?? null,
              ruleDiscountBps: quote.rule?.discountBps ?? null,
              rulePriceCents: quote.rule?.priceCents ?? null,
              unitPriceCents: quote.unitPriceCents,
              lineTotalCents: quote.lineTotalCents,
            })
            .returning()
          lineId = created.id
          existing.push(created)
        }
        for (const { lotId, quantity } of allocations[index]) {
          const held = (
            await tx
              .select()
              .from(orderAllocations)
              .where(
                and(
                  eq(orderAllocations.orderLineId, lineId),
                  eq(orderAllocations.lotId, lotId),
                ),
              )
          ).at(0)
          if (held) {
            await tx
              .update(orderAllocations)
              .set({ quantity: held.quantity + quantity })
              .where(eq(orderAllocations.id, held.id))
          } else {
            await tx
              .insert(orderAllocations)
              .values({ orderLineId: lineId, lotId, quantity })
          }
        }
      }
      const totalCents = existing.reduce((sum, l) => sum + l.lineTotalCents, 0)
      if (!fitsInt4(totalCents)) {
        throw new AppError(
          'invalid',
          'El total del pedido es demasiado grande.',
        )
      }
      await tx.update(orders).set({ totalCents }).where(eq(orders.id, order.id))
    },
  )
}

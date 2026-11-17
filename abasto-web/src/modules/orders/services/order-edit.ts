import { and, asc, eq, inArray } from 'drizzle-orm'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { presentations } from '#/modules/catalog/db/schema'
import { lots } from '#/modules/inventory/db/schema'
import { fitsInt4 } from '#/modules/inventory/services/stock-ledger'
import type { Tx } from '#/modules/inventory/services/stock-ledger'
import {
  orderAllocations,
  orderLines,
  orders,
} from '#/modules/orders/db/schema'
import { transition } from '#/modules/orders/services/order-actions'
import {
  byFifo,
  reserveAllocations,
} from '#/modules/orders/services/order-allocation'
import {
  quoteLines,
  validateLines,
} from '#/modules/orders/services/order-quotes'
import type { OrderLineInput } from '#/modules/orders/services/order-quotes'
import type { OrderDetail } from '#/modules/orders/services/order-reads'
import {
  lockLotsInOrder,
  releaseLots,
} from '#/modules/orders/services/reservations'

type Order = typeof orders.$inferSelect

export type AddToOrderInput = {
  orderId: string
  /** Units to ADD, in the presentation: raises the line of that presentation or opens a new one. */
  lines: Array<OrderLineInput>
}

export type EditOrderInput = {
  orderId: string
  /** New TOTAL quantity of lines already in the order; 0 removes the line. */
  changes: Array<{ presentationId: string; quantity: number }>
  /** Units to ADD of other products (a new line priced like a new order). */
  add: Array<OrderLineInput>
}

const tooLarge = () =>
  new AppError('invalid', 'La cantidad del pedido es demasiado grande.')

const operate = (actor: Actor) => (head: { warehouseId: string }) =>
  authorize(actor, 'warehouse.operate', head.warehouseId)

/** Prices and reserves the units to add (raising a line or opening one). Callers recompute the total. */
async function addUnits(tx: Tx, order: Order, lines: Array<OrderLineInput>) {
  const quotes = await quoteLines(tx, order, lines)
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
}

async function recomputeTotal(tx: Tx, orderId: string) {
  const rows = await tx
    .select({ lineTotalCents: orderLines.lineTotalCents })
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId))
  const totalCents = rows.reduce((sum, l) => sum + l.lineTotalCents, 0)
  if (!fitsInt4(totalCents)) {
    throw new AppError('invalid', 'El total del pedido es demasiado grande.')
  }
  await tx.update(orders).set({ totalCents }).where(eq(orders.id, orderId))
}

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
    operate(actor),
    input.orderId,
    ['Reservado'],
    'Solo se puede editar un pedido reservado.',
    async (tx, order) => {
      await addUnits(tx, order, input.lines)
      await recomputeTotal(tx, order.id)
    },
  )
}

function validateEdit(input: EditOrderInput) {
  if (!input.changes.length && !input.add.length) {
    throw new AppError('invalid', 'No hay cambios que guardar.')
  }
  for (const { quantity } of input.changes) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new AppError(
        'invalid',
        'La cantidad de cada producto debe ser un entero de cero o más.',
      )
    }
    if (!fitsInt4(quantity)) throw tooLarge()
  }
  if (input.add.length) validateLines(input.add)
  const ids = [...input.changes, ...input.add].map((l) => l.presentationId)
  if (new Set(ids).size !== ids.length) {
    throw new AppError(
      'invalid',
      'No repitas la misma presentación en el pedido.',
    )
  }
}

type OrderLine = typeof orderLines.$inferSelect

/**
 * Takes `units` base units out of the line's allocations, newest lot first
 * (the reverse of how they were reserved), and returns what each lot gives back.
 */
async function releaseFromLine(
  tx: Tx,
  line: OrderLine,
  units: number,
  lotOf: ReadonlyMap<string, { receivedAt: Date; id: string }>,
  perLot: Map<string, number>,
) {
  const held = await tx
    .select()
    .from(orderAllocations)
    .where(eq(orderAllocations.orderLineId, line.id))
    .orderBy(asc(orderAllocations.id))
  held.sort((a, b) => byFifo(lotOf.get(b.lotId)!, lotOf.get(a.lotId)!))
  let remaining = units
  for (const allocation of held) {
    if (!remaining) break
    const take = Math.min(allocation.quantity, remaining)
    remaining -= take
    perLot.set(allocation.lotId, (perLot.get(allocation.lotId) ?? 0) + take)
    if (take === allocation.quantity) {
      await tx
        .delete(orderAllocations)
        .where(eq(orderAllocations.id, allocation.id))
    } else {
      await tx
        .update(orderAllocations)
        .set({ quantity: allocation.quantity - take })
        .where(eq(orderAllocations.id, allocation.id))
    }
  }
}

/**
 * Edits the lines of a Reservado, unexpired order in one transaction: lines
 * can be lowered (the reserved units go back to their lots, newest lot first),
 * removed (quantity 0) or raised, and other products added. Raised lines keep
 * their frozen unit price; new lines are quoted like a new order. The last
 * line cannot be removed. Any rejection leaves the order and lots untouched.
 */
export async function editReservedOrder(
  actor: Actor,
  input: EditOrderInput,
): Promise<OrderDetail> {
  validateEdit(input)
  return transition(
    operate(actor),
    input.orderId,
    ['Reservado'],
    'Solo se puede editar un pedido reservado.',
    async (tx, order) => {
      const existing = await tx
        .select()
        .from(orderLines)
        .where(eq(orderLines.orderId, order.id))
      const lineOf = new Map(existing.map((l) => [l.presentationId, l]))
      const lowered: Array<{ line: OrderLine; target: number }> = []
      const raised: Array<OrderLineInput> = []
      for (const { presentationId, quantity } of input.changes) {
        const line = lineOf.get(presentationId)
        if (!line) {
          throw new AppError(
            'invalid',
            'Ese producto no está en el pedido. Agrégalo con el buscador.',
          )
        }
        if (quantity < line.quantity) lowered.push({ line, target: quantity })
        else if (quantity > line.quantity) {
          raised.push({ presentationId, quantity: quantity - line.quantity })
        }
      }
      const removed = lowered.filter((l) => l.target === 0).length
      const opened = input.add.filter((l) => !lineOf.has(l.presentationId))
      if (existing.length - removed + opened.length === 0) {
        throw new AppError(
          'invalid',
          'El pedido no puede quedar sin productos. Usa «Cancelar pedido» si ya no lo quieren.',
        )
      }
      const grown = [...raised, ...input.add]

      // One ordered lock over every lot this edit touches (the lots it gives
      // back and those of the products it adds to), as every order operation
      // locks in id order, so concurrent orders cannot deadlock.
      const touched = new Set<string>()
      if (lowered.length) {
        const rows = await tx
          .select({ lotId: orderAllocations.lotId })
          .from(orderAllocations)
          .where(
            inArray(
              orderAllocations.orderLineId,
              lowered.map((l) => l.line.id),
            ),
          )
        for (const { lotId } of rows) touched.add(lotId)
      }
      if (grown.length) {
        const rows = await tx
          .select({ id: lots.id })
          .from(lots)
          .innerJoin(presentations, eq(presentations.productId, lots.productId))
          .where(
            and(
              eq(lots.warehouseId, order.warehouseId),
              inArray(
                presentations.id,
                grown.map((l) => l.presentationId),
              ),
            ),
          )
        for (const { id } of rows) touched.add(id)
      }
      const locked = await lockLotsInOrder(tx, [...touched])

      const perLot = new Map<string, number>()
      for (const { line, target } of lowered) {
        const factor = line.baseQuantity / line.quantity
        await releaseFromLine(
          tx,
          line,
          (line.quantity - target) * factor,
          locked,
          perLot,
        )
        if (target === 0) {
          await tx.delete(orderLines).where(eq(orderLines.id, line.id))
        } else {
          await tx
            .update(orderLines)
            .set({
              quantity: target,
              baseQuantity: target * factor,
              lineTotalCents: line.unitPriceCents * target,
            })
            .where(eq(orderLines.id, line.id))
        }
      }
      await releaseLots(tx, perLot)
      if (grown.length) await addUnits(tx, order, grown)
      await recomputeTotal(tx, order.id)
    },
  )
}

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { productArchived } from '#/modules/catalog/services/product-reads'
import { purchaseLines, purchases } from '#/modules/inventory/db/schema'
import { loadBoxProducts } from '#/modules/inventory/services/box-products'
import {
  activeDiscounts,
  lockSupplier,
  reopenEntries,
} from '#/modules/inventory/services/supplier-balance'
import { priceOrderLine } from '#/modules/inventory/services/supplier-order-lines'
import { orderNotFound } from '#/modules/inventory/services/supplier-order-reads'
import { isWholeNumber } from '#/modules/inventory/services/stock-ledger'

export type SupplierOrderEditInput = {
  purchaseId: string
  /** The full set of lines the order ends with: kept, changed and added products. */
  lines: Array<{ productId: string; boxes: number }>
}

function validate(input: SupplierOrderEditInput) {
  if (!input.lines.length) {
    throw new AppError(
      'invalid',
      'El pedido no puede quedar sin productos. Para descartarlo usa «Cancelar pedido».',
    )
  }
  const seen = new Set<string>()
  for (const line of input.lines) {
    if (!isWholeNumber(line.boxes) || line.boxes <= 0) {
      throw new AppError(
        'invalid',
        'Las cajas deben ser un número entero mayor que cero.',
      )
    }
    if (seen.has(line.productId)) {
      throw new AppError(
        'invalid',
        'Cada producto solo puede aparecer una vez en el pedido.',
      )
    }
    seen.add(line.productId)
  }
}

/**
 * Rewrites the lines of an order still in «Pedido»; it keeps its folio and
 * date. Lines already on the order keep the price, discount, promotion and box
 * factor frozen when it was made (only their boxes change); products added now
 * take the catalog terms and must belong to the order's supplier. Lines not
 * sent are removed. Costs follow the same rule as creating an order.
 *
 * Discounts: an applied balance discount can never exceed the new net total.
 * When it does, the most recently applied discounts are reopened (mirror
 * entries, the same way cancelling does) until what is left fits. Nothing is
 * ever discounted anew by an edit.
 */
export async function editSupplierOrder(
  actor: Actor,
  input: SupplierOrderEditInput,
): Promise<{ discountCents: number; reopened: number }> {
  return db.transaction(async (tx) => {
    const order = (
      await tx
        .select({
          warehouseId: purchases.warehouseId,
          supplierId: purchases.supplierId,
          status: purchases.status,
        })
        .from(purchases)
        .where(eq(purchases.id, input.purchaseId))
        .for('update')
    ).at(0)
    if (!order) throw orderNotFound()
    authorize(actor, 'warehouse.manage', order.warehouseId)
    if (order.status !== 'Pedido') {
      throw new AppError(
        'conflict',
        'Solo se puede editar un pedido pendiente de recibir.',
      )
    }
    validate(input)
    // Same order as cancelling: the order row first, then the supplier.
    await lockSupplier(tx, order.supplierId)
    const current = await tx
      .select()
      .from(purchaseLines)
      .where(eq(purchaseLines.purchaseId, input.purchaseId))
    const byProduct = new Map(current.map((line) => [line.productId, line]))
    const added = input.lines
      .filter((line) => !byProduct.has(line.productId))
      .map((line) => line.productId)
    const found = await loadBoxProducts(tx, added)

    const updates: Array<{
      id: string
      values: ReturnType<typeof priceOrderLine>
    }> = []
    const inserts: Array<typeof purchaseLines.$inferInsert> = []
    for (const line of input.lines) {
      const kept = byProduct.get(line.productId)
      if (kept) {
        updates.push({
          id: kept.id,
          values: priceOrderLine(line.boxes * kept.boxFactor, kept),
        })
        continue
      }
      const product = found.get(line.productId)
      if (!product) {
        throw new AppError('not_found', 'No encontramos ese producto.')
      }
      if (product.archivedAt) throw productArchived()
      if (product.supplierId !== order.supplierId) {
        throw new AppError(
          'invalid',
          'Ese producto no pertenece a este proveedor.',
        )
      }
      inserts.push({
        purchaseId: input.purchaseId,
        productId: line.productId,
        ...priceOrderLine(line.boxes * product.factor, product),
        boxFactor: product.factor,
        listPricePerPiece: product.listPricePerPiece,
        orderedListPricePerPiece: product.listPricePerPiece,
        fixedDiscountPerPiece: product.fixedDiscountPerPiece,
        promotionPerPiece: product.promotionPerPiece,
      })
    }
    const netCents =
      updates.reduce((sum, item) => sum + item.values.totalCostCents, 0) +
      inserts.reduce((sum, item) => sum + item.totalCostCents, 0)

    const keptIds = updates.map((item) => item.id)
    const removed = current.filter((line) => !keptIds.includes(line.id))
    if (removed.length) {
      await tx.delete(purchaseLines).where(
        and(
          eq(purchaseLines.purchaseId, input.purchaseId),
          inArray(
            purchaseLines.id,
            removed.map((line) => line.id),
          ),
        ),
      )
    }
    for (const item of updates) {
      await tx
        .update(purchaseLines)
        .set(item.values)
        .where(eq(purchaseLines.id, item.id))
    }
    if (inserts.length) await tx.insert(purchaseLines).values(inserts)

    const discounts = await activeDiscounts(tx, input.purchaseId)
    let discountCents = discounts.reduce(
      (sum, entry) => sum - entry.valueCents,
      0,
    )
    const toReopen: typeof discounts = []
    // Newest first: the discounts applied last are the first to go.
    for (const entry of [...discounts].reverse()) {
      if (discountCents <= netCents) break
      toReopen.push(entry)
      discountCents += entry.valueCents
    }
    await reopenEntries(tx, input.purchaseId, toReopen, actor.userId)
    await tx
      .update(purchases)
      .set({ discountCents })
      .where(eq(purchases.id, input.purchaseId))
    return { discountCents, reopened: toReopen.length }
  })
}

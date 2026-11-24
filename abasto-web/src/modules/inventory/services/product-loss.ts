import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { products } from '#/modules/catalog/db/schema'
import { lossCategories, lots } from '#/modules/inventory/db/schema'
import type { LossCategory } from '#/modules/inventory/db/schema'
import { allocateFefo } from '#/modules/inventory/lib/fefo-allocation'
import {
  appendMovement,
  assertFitsInt4,
  isWholeNumber,
  MAX_INT4,
  requireWarehouse,
} from '#/modules/inventory/services/stock-ledger'
import { expireOverdueOrders } from '#/modules/orders/services/expiry'

export type ProductLossLine = { productId: string; pieces: number }

export type ProductLossInput = {
  warehouseId: string
  lines: ReadonlyArray<ProductLossLine>
  /** Merma is damaged or expired product only. */
  category: Extract<LossCategory, 'dañado' | 'caducado'>
  note?: string
}

const mermaCategories: ReadonlyArray<LossCategory> = ['dañado', 'caducado']

const notEnough = () =>
  new AppError(
    'conflict',
    'No hay suficientes piezas disponibles para dar de baja.',
  )

/**
 * Owner-only merma: removes whole pieces of several products from one
 * warehouse as `loss` movements, taking each product's lots earliest expiry
 * first. Held units are untouchable; every line applies in one transaction,
 * so a line that does not fit leaves everything as it was.
 */
export async function registerProductLoss(
  actor: Actor,
  input: ProductLossInput,
): Promise<{ pieces: number }> {
  authorize(actor, 'stock.adjust', input.warehouseId)
  if (
    !mermaCategories.includes(input.category) ||
    !lossCategories.includes(input.category)
  ) {
    throw new AppError('invalid', 'Selecciona si está dañado o caducado.')
  }
  if (!input.lines.length) {
    throw new AppError('invalid', 'Indica las piezas de al menos un producto.')
  }
  for (const line of input.lines) {
    if (!isWholeNumber(line.pieces) || line.pieces < 1) {
      throw new AppError(
        'invalid',
        'Indica un número entero de piezas, de 1 en adelante.',
      )
    }
    assertFitsInt4(
      line.pieces,
      `La cantidad no puede ser mayor que ${MAX_INT4}.`,
    )
  }
  const productIds = input.lines.map((line) => line.productId)
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError(
      'invalid',
      'Cada producto solo puede aparecer una vez en la merma.',
    )
  }
  const note = input.note?.trim()
  const reason = note ? `${input.category}: ${note}` : input.category
  // Stable order keeps concurrent multi-line removals from deadlocking.
  const ordered = [...input.lines].sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
  )
  return db.transaction(async (tx) => {
    await requireWarehouse(tx, input.warehouseId)
    const found = await tx
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, productIds))
    if (found.length !== productIds.length) {
      throw new AppError('not_found', 'No encontramos ese producto.')
    }
    // Overdue orders release their units before the lots are locked.
    await expireOverdueOrders(tx, input.warehouseId)
    for (const line of ordered) {
      const candidates = await tx
        .select()
        .from(lots)
        .where(
          and(
            eq(lots.warehouseId, input.warehouseId),
            eq(lots.productId, line.productId),
            gt(lots.onHand, lots.reserved),
          ),
        )
        .orderBy(asc(lots.id))
        .for('update')
      const { taken, missing } = allocateFefo(
        candidates.map((lot) => ({
          id: lot.id,
          free: lot.onHand - lot.reserved,
          expiresOn: lot.expiresOn,
          receivedAt: lot.receivedAt,
        })),
        line.pieces,
      )
      if (missing > 0) throw notEnough()
      for (const { lotId, quantity } of taken) {
        const lot = candidates.find(({ id }) => id === lotId)
        if (!lot) continue
        await appendMovement(tx, lot, {
          type: 'loss',
          quantity: -quantity,
          reason,
          actorId: actor.userId,
        })
      }
    }
    return {
      pieces: input.lines.reduce((sum, line) => sum + line.pieces, 0),
    }
  })
}

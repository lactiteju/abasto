import { and, asc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { presentations, products } from '#/modules/catalog/db/schema'
import { productArchived } from '#/modules/catalog/services/product-reads'
import { lots } from '#/modules/inventory/db/schema'
import {
  appendMovement,
  assertFitsInt4,
  byFefo,
  isWholeNumber,
  MAX_INT4,
  requireWarehouse,
} from '#/modules/inventory/services/stock-ledger'
import type { Tx } from '#/modules/inventory/services/stock-ledger'
import { businessDate, now } from '#/modules/orders/services/clock'
import { expireOverdueOrders } from '#/modules/orders/services/expiry'
import { transferredCostCents } from '#/modules/transfers/lib/transfer-cost'
import { transferLines, transfers } from '#/modules/transfers/db/schema'
import { warehouses } from '#/modules/warehouses/db/schema'

export type OwnerTransferInput = {
  fromWarehouseId: string
  toWarehouseId: string
  productId: string
  /** Whole boxes of the product's default presentation. */
  boxes: number
}

export type TransferableProduct = {
  productId: string
  name: string
  sku: string
  /** Base units per box (default presentation). */
  factor: number
  /** Whole boxes available (not reserved, not expired). */
  boxes: number
}

const notEnough = () =>
  new AppError('conflict', 'No hay suficientes cajas disponibles en el origen.')

/** Lots a transfer may take from: units free of orders, not past expiry. */
const takeable = (warehouseId: string, productIds: Array<string>) =>
  and(
    eq(lots.warehouseId, warehouseId),
    inArray(lots.productId, productIds),
    gt(lots.onHand, lots.reserved),
    or(isNull(lots.expiresOn), gte(lots.expiresOn, businessDate())),
  )

async function defaultFactor(tx: Tx, productId: string) {
  return (
    await tx
      .select({ factor: presentations.factor })
      .from(presentations)
      .where(
        and(
          eq(presentations.productId, productId),
          eq(presentations.isDefault, true),
        ),
      )
  ).at(0)?.factor
}

/** Products with at least one whole box available in a warehouse (owner only). */
export async function listTransferableBoxes(
  actor: Actor,
  warehouseId: string,
): Promise<Array<TransferableProduct>> {
  authorize(actor, 'warehouses.manage')
  return db.transaction(async (tx) => {
    await expireOverdueOrders(tx, warehouseId)
    const rows = await tx
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        factor: presentations.factor,
        units: sql<number>`sum(${lots.onHand} - ${lots.reserved})::int`,
      })
      .from(lots)
      .innerJoin(products, eq(products.id, lots.productId))
      .innerJoin(
        presentations,
        and(
          eq(presentations.productId, products.id),
          eq(presentations.isDefault, true),
        ),
      )
      .where(
        and(
          eq(lots.warehouseId, warehouseId),
          gt(lots.onHand, lots.reserved),
          or(isNull(lots.expiresOn), gte(lots.expiresOn, businessDate())),
          isNull(products.archivedAt),
        ),
      )
      .groupBy(products.id, products.name, products.sku, presentations.factor)
      .orderBy(asc(products.name))
    return rows
      .map(({ units, ...row }) => ({
        ...row,
        boxes: Math.floor(units / row.factor),
      }))
      .filter((row) => row.boxes >= 1)
  })
}

/**
 * Owner-only immediate transfer in whole boxes: units leave the origin and
 * enter the destination at once (earliest expiry first, only free non-expired
 * units), recorded as an already received transfer so it shows in history.
 */
export async function transferBoxes(
  actor: Actor,
  input: OwnerTransferInput,
): Promise<{ id: string }> {
  authorize(actor, 'warehouses.manage')
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new AppError(
      'invalid',
      'El origen y el destino del traspaso deben ser distintos.',
    )
  }
  if (!isWholeNumber(input.boxes) || input.boxes < 1) {
    throw new AppError(
      'invalid',
      'Indica un número entero de cajas, de 1 en adelante.',
    )
  }
  return db.transaction(async (tx) => {
    await requireWarehouse(tx, input.fromWarehouseId)
    await requireWarehouse(tx, input.toWarehouseId)
    await expireOverdueOrders(tx, input.fromWarehouseId)
    const product = (
      await tx
        .select({ id: products.id, archivedAt: products.archivedAt })
        .from(products)
        .where(eq(products.id, input.productId))
    ).at(0)
    if (!product)
      throw new AppError('not_found', 'No encontramos ese producto.')
    if (product.archivedAt) throw productArchived()
    const factor = await defaultFactor(tx, input.productId)
    if (!factor) {
      throw new AppError(
        'invalid',
        'Ese producto no tiene una presentación predeterminada.',
      )
    }
    const quantity = input.boxes * factor
    assertFitsInt4(quantity, `La cantidad no puede ser mayor que ${MAX_INT4}.`)
    const candidates = (
      await tx
        .select()
        .from(lots)
        .where(takeable(input.fromWarehouseId, [input.productId]))
        .orderBy(asc(lots.id))
        .for('update')
    ).sort((a, b) => byFefo(a, b) || (a.id < b.id ? -1 : 1))
    const taken: Array<{ lot: (typeof candidates)[number]; quantity: number }> =
      []
    let remaining = quantity
    for (const lot of candidates) {
      if (!remaining) break
      const take = Math.min(lot.onHand - lot.reserved, remaining)
      taken.push({ lot, quantity: take })
      remaining -= take
    }
    if (remaining) throw notEnough()
    const names = new Map(
      (
        await tx
          .select({ id: warehouses.id, name: warehouses.name })
          .from(warehouses)
          .where(
            inArray(warehouses.id, [
              input.fromWarehouseId,
              input.toWarehouseId,
            ]),
          )
      ).map((row) => [row.id, row.name]),
    )
    const [transfer] = await tx
      .insert(transfers)
      .values({
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: 'Recibido',
        notes: `Traspaso inmediato de ${input.boxes} ${input.boxes === 1 ? 'caja' : 'cajas'}`,
        createdBy: actor.userId,
        closedBy: actor.userId,
        closedAt: now(),
      })
      .returning({ id: transfers.id })
    for (const { lot, quantity: units } of taken) {
      await appendMovement(tx, lot, {
        type: 'transfer_out',
        quantity: -units,
        reason: `Traspaso a ${names.get(input.toWarehouseId)}`,
        reference: transfer.id,
        actorId: actor.userId,
      })
      const [created] = await tx
        .insert(lots)
        .values({
          productId: lot.productId,
          warehouseId: input.toWarehouseId,
          sourceLotId: lot.id,
          code: lot.code,
          expiresOn: lot.expiresOn,
          salePriceCents: lot.salePriceCents,
          receivedQuantity: units,
          receivedCostCents: transferredCostCents(
            lot.receivedCostCents,
            lot.receivedQuantity,
            units,
          ),
          onHand: 0,
        })
        .returning()
      await appendMovement(tx, created, {
        type: 'transfer_in',
        quantity: units,
        reason: `Traspaso desde ${names.get(input.fromWarehouseId)}`,
        reference: transfer.id,
        actorId: actor.userId,
      })
      await tx.insert(transferLines).values({
        transferId: transfer.id,
        productId: lot.productId,
        sourceLotId: lot.id,
        quantity: units,
        receivedQuantity: units,
        destinationLotId: created.id,
      })
    }
    return { id: transfer.id }
  })
}

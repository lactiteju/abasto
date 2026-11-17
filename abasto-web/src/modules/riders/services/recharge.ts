import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import {
  fitsInt4,
  requireWarehouse,
} from '#/modules/inventory/services/stock-ledger'
import { expireOverdueOrders } from '#/modules/orders/services/expiry'
import {
  fifoPlanner,
  readSellableLots,
  reserveAllocations,
} from '#/modules/orders/services/order-allocation'
import {
  riderAllocations,
  riderAssignmentLines,
} from '#/modules/riders/db/schema'
import { toBaseUnits } from '#/modules/riders/lib/quantities'
import {
  readAssignment,
  warehouseOfAssignment,
} from '#/modules/riders/services/assignment-reads'
import type { Tx } from '#/modules/inventory/services/stock-ledger'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import {
  allocationRows,
  readPricing,
  readProducts,
  lockOpenAssignment,
  validateAssignLines,
} from '#/modules/riders/services/assignments'
import type { AssignLineInput } from '#/modules/riders/services/assignments'

/**
 * Tops up an "En ruta" assignment (a «Recarga»): the extra units come from the
 * warehouse exactly like a new assignment (FIFO lots, expired lots excluded,
 * no overselling, prices frozen now) and go onto the same assignment, raising
 * the product's line or adding a new one. Settlement then covers everything.
 * Nothing changes when the assignment is not "En ruta" or any product is short.
 */
export async function rechargeAssignment(
  actor: Actor,
  input: { assignmentId: string; lines: ReadonlyArray<AssignLineInput> },
): Promise<AssignmentDetail> {
  const warehouseId = await warehouseOfAssignment(db, input.assignmentId)
  authorize(actor, 'warehouse.operate', warehouseId)
  validateAssignLines(input.lines)
  return db.transaction(async (tx) => {
    await requireWarehouse(tx, warehouseId)
    await expireOverdueOrders(tx, warehouseId)
    const assignment = await lockOpenAssignment(tx, input.assignmentId)
    await addToAssignment(tx, assignment, input.lines)
    return readAssignment(tx, assignment.id)
  })
}

/**
 * Takes the units from the warehouse (FIFO, same availability rules as
 * assigning, prices frozen now) and puts them on the assignment, raising the
 * product's line or opening a new one. Callers hold the assignment lock.
 */
export async function addToAssignment(
  tx: Tx,
  assignment: { id: string; warehouseId: string },
  lines: ReadonlyArray<AssignLineInput>,
) {
  const { warehouseId } = assignment
  const productIds = lines.map((line) => line.productId)
  const info = await readProducts(tx, productIds)
  const wanted = lines.map((line) => {
    const product = info.get(line.productId)
    if (!product) {
      throw new AppError('not_found', 'No encontramos ese producto.')
    }
    const baseQuantity = toBaseUnits(line, product.boxFactor)
    if (baseQuantity < 1) {
      throw new AppError(
        'invalid',
        `Indica cuántas cajas o unidades de ${product.name}.`,
      )
    }
    return { productId: line.productId, product, baseQuantity }
  })
  const sellable = await readSellableLots(tx, warehouseId, productIds, {
    lock: true,
  })
  const lotById = new Map(sellable.map((lot) => [lot.id, lot]))
  const pricing = await readPricing(tx, warehouseId)
  const plan = fifoPlanner(sellable)
  const plans = wanted.map((line) => ({
    productName: line.product.name,
    ...plan(line.productId, line.baseQuantity),
  }))
  const allocations = await reserveAllocations(tx, plans)
  const existing = await tx
    .select()
    .from(riderAssignmentLines)
    .where(eq(riderAssignmentLines.assignmentId, assignment.id))
  for (const [index, line] of wanted.entries()) {
    const current = existing.find((e) => e.productId === line.productId)
    let lineId: string
    if (current) {
      const total = current.assignedQuantity + line.baseQuantity
      if (!fitsInt4(total)) {
        throw new AppError('invalid', 'La cantidad es demasiado grande.')
      }
      await tx
        .update(riderAssignmentLines)
        .set({ assignedQuantity: total })
        .where(eq(riderAssignmentLines.id, current.id))
      lineId = current.id
    } else {
      const [stored] = await tx
        .insert(riderAssignmentLines)
        .values({
          assignmentId: assignment.id,
          productId: line.productId,
          boxFactor: line.product.boxFactor,
          assignedQuantity: line.baseQuantity,
        })
        .returning({ id: riderAssignmentLines.id })
      lineId = stored.id
    }
    const rows = allocationRows(
      lineId,
      line.product,
      allocations[index],
      lotById,
      pricing,
    )
    const held = current
      ? await tx
          .select()
          .from(riderAllocations)
          .where(eq(riderAllocations.lineId, lineId))
      : []
    for (const row of rows) {
      // Same lot at the same frozen prices: just more units of that allocation.
      const same = held.find(
        (a) =>
          a.lotId === row.lotId &&
          a.priceCents === row.priceCents &&
          a.priceFactor === row.priceFactor &&
          a.pieceCents === row.pieceCents,
      )
      if (same) {
        await tx
          .update(riderAllocations)
          .set({ quantity: same.quantity + row.quantity })
          .where(eq(riderAllocations.id, same.id))
      } else {
        await tx.insert(riderAllocations).values(row)
      }
    }
  }
}

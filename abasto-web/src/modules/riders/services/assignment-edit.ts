import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { lots } from '#/modules/inventory/db/schema'
import { requireWarehouse } from '#/modules/inventory/services/stock-ledger'
import type { Tx } from '#/modules/inventory/services/stock-ledger'
import { expireOverdueOrders } from '#/modules/orders/services/expiry'
import { byFifo } from '#/modules/orders/services/order-allocation'
import {
  lockLotsInOrder,
  releaseLots,
} from '#/modules/orders/services/reservations'
import {
  riderAllocations,
  riderAssignmentLines,
} from '#/modules/riders/db/schema'
import { isUuid, toBaseUnits } from '#/modules/riders/lib/quantities'
import type { BoxesAndUnits } from '#/modules/riders/lib/quantities'
import {
  readAssignment,
  warehouseOfAssignment,
} from '#/modules/riders/services/assignment-reads'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import {
  lockOpenAssignment,
  validateAssignLines,
} from '#/modules/riders/services/assignments'
import type { AssignLineInput } from '#/modules/riders/services/assignments'
import { addToAssignment } from '#/modules/riders/services/recharge'

export type EditAssignmentInput = {
  assignmentId: string
  /** New TOTAL (boxes + units) of products already on the assignment; 0 removes the line. */
  changes: ReadonlyArray<BoxesAndUnits & { productId: string }>
  /** Units to ADD of products, like a recarga (raises a line or opens one). */
  add: ReadonlyArray<AssignLineInput>
}

type Line = typeof riderAssignmentLines.$inferSelect

function validateEdit(input: EditAssignmentInput) {
  if (!input.changes.length && !input.add.length) {
    throw new AppError('invalid', 'No hay cambios que guardar.')
  }
  const ids = [...input.changes, ...input.add].map((l) => l.productId)
  if (ids.some((id) => !isUuid(id))) {
    throw new AppError('not_found', 'No encontramos ese producto.')
  }
  if (new Set(ids).size !== ids.length) {
    throw new AppError('invalid', 'No repitas el mismo producto en el reparto.')
  }
  if (input.add.length) validateAssignLines(input.add)
}

/**
 * Takes `units` base units out of the line's allocations, newest lot first
 * (the reverse of how they were reserved), deleting emptied allocations, and
 * adds what each lot gets back to `perLot`.
 */
async function releaseFromLine(
  tx: Tx,
  line: Line,
  units: number,
  lotOf: ReadonlyMap<string, { receivedAt: Date; id: string }>,
  perLot: Map<string, number>,
) {
  const held = await tx
    .select()
    .from(riderAllocations)
    .where(eq(riderAllocations.lineId, line.id))
    .orderBy(asc(riderAllocations.id))
  held.sort((a, b) => byFifo(lotOf.get(b.lotId)!, lotOf.get(a.lotId)!))
  let remaining = units
  for (const allocation of held) {
    if (!remaining) break
    const take = Math.min(allocation.quantity, remaining)
    remaining -= take
    perLot.set(allocation.lotId, (perLot.get(allocation.lotId) ?? 0) + take)
    if (take === allocation.quantity) {
      await tx
        .delete(riderAllocations)
        .where(eq(riderAllocations.id, allocation.id))
    } else {
      await tx
        .update(riderAllocations)
        .set({ quantity: allocation.quantity - take })
        .where(eq(riderAllocations.id, allocation.id))
    }
  }
}

/**
 * Edits the load of an "En ruta" assignment in one transaction: lines can be
 * lowered (units go back to their lots, newest lot first), removed (total 0),
 * raised or added like a recarga. The assignment cannot end up with no lines.
 * Any rejection leaves the assignment and the lots untouched.
 */
export async function editAssignmentLoad(
  actor: Actor,
  input: EditAssignmentInput,
): Promise<AssignmentDetail> {
  const warehouseId = await warehouseOfAssignment(db, input.assignmentId)
  authorize(actor, 'warehouse.operate', warehouseId)
  validateEdit(input)
  return db.transaction(async (tx) => {
    await requireWarehouse(tx, warehouseId)
    await expireOverdueOrders(tx, warehouseId)
    const assignment = await lockOpenAssignment(tx, input.assignmentId)
    const existing = await tx
      .select()
      .from(riderAssignmentLines)
      .where(eq(riderAssignmentLines.assignmentId, assignment.id))
      .orderBy(asc(riderAssignmentLines.id))
    const lineOf = new Map(existing.map((l) => [l.productId, l]))
    const lowered: Array<{ line: Line; target: number }> = []
    const grown: Array<AssignLineInput> = []
    for (const change of input.changes) {
      const line = lineOf.get(change.productId)
      if (!line) {
        throw new AppError(
          'invalid',
          'Ese producto no está en el reparto. Agrégalo con el buscador.',
        )
      }
      const target = toBaseUnits(change, line.boxFactor)
      if (target < line.assignedQuantity) lowered.push({ line, target })
      else if (target > line.assignedQuantity) {
        grown.push({
          productId: change.productId,
          units: target - line.assignedQuantity,
        })
      }
    }
    grown.push(...input.add)
    const removed = lowered.filter((l) => l.target === 0).length
    const opened = input.add.filter((l) => !lineOf.has(l.productId)).length
    if (existing.length - removed + opened === 0) {
      throw new AppError(
        'invalid',
        'El reparto no puede quedar sin productos. Si ya no sale, cancélalo desde el menú ⋯ del reparto.',
      )
    }

    // One ordered lock over every lot this edit touches (those it gives back
    // and those of the products it adds to): every stock operation locks in
    // id order, so concurrent operations cannot deadlock.
    const touched = new Set<string>()
    if (lowered.length) {
      const rows = await tx
        .select({ lotId: riderAllocations.lotId })
        .from(riderAllocations)
        .where(
          inArray(
            riderAllocations.lineId,
            lowered.map((l) => l.line.id),
          ),
        )
      for (const { lotId } of rows) touched.add(lotId)
    }
    if (grown.length) {
      const rows = await tx
        .select({ id: lots.id })
        .from(lots)
        .where(
          and(
            eq(lots.warehouseId, warehouseId),
            inArray(
              lots.productId,
              grown.map((l) => l.productId),
            ),
          ),
        )
      for (const { id } of rows) touched.add(id)
    }
    const locked = await lockLotsInOrder(tx, [...touched])

    const perLot = new Map<string, number>()
    for (const { line, target } of lowered) {
      await releaseFromLine(
        tx,
        line,
        line.assignedQuantity - target,
        locked,
        perLot,
      )
      if (target === 0) {
        await tx
          .delete(riderAssignmentLines)
          .where(eq(riderAssignmentLines.id, line.id))
      } else {
        await tx
          .update(riderAssignmentLines)
          .set({ assignedQuantity: target })
          .where(eq(riderAssignmentLines.id, line.id))
      }
    }
    await releaseLots(tx, perLot)
    if (grown.length) await addToAssignment(tx, assignment, grown)
    return readAssignment(tx, assignment.id)
  })
}

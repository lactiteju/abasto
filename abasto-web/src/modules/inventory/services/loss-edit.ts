import { and, eq } from 'drizzle-orm'
import { db } from '#/db'
import { AppError } from '#/lib/errors'
import { authorize } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { lossCategories, stockMovements } from '#/modules/inventory/db/schema'
import type { LossCategory } from '#/modules/inventory/db/schema'
import {
  editedLossReference,
  isEditableLossReference,
  lossRootId,
  voidedLossReference,
} from '#/modules/inventory/lib/loss-edits'
import {
  appendMovement,
  assertFitsInt4,
  isWholeNumber,
  lockLot,
  MAX_INT4,
} from '#/modules/inventory/services/stock-ledger'
import type { Tx } from '#/modules/inventory/services/stock-ledger'

export type LossEditInput = {
  movementId: string
  pieces: number
  category: LossCategory
  note: string
}

/**
 * Locks the lot of a merma the owner may still correct: a `loss` the owner
 * registered (not a rider settlement's), not already edited or voided.
 */
async function openLoss(tx: Tx, actor: Actor, movementId: string) {
  const movement = (
    await tx
      .select()
      .from(stockMovements)
      .where(
        and(eq(stockMovements.id, movementId), eq(stockMovements.type, 'loss')),
      )
  ).at(0)
  if (!movement || movement.quantity >= 0) {
    throw new AppError('not_found', 'No encontramos esa merma.')
  }
  authorize(actor, 'stock.adjust', movement.warehouseId)
  if (!isEditableLossReference(movement.reference)) {
    throw new AppError(
      'invalid',
      'Esta merma viene de la liquidación de un reparto y no se puede modificar aquí.',
    )
  }
  // The lot lock serializes corrections of the same merma.
  const lot = await lockLot(tx, movement.lotId)
  const voided = await tx
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.reference, voidedLossReference(movement.id)))
    .limit(1)
  if (voided.length) {
    throw new AppError(
      'conflict',
      'Esta merma ya se modificó. Actualiza la página e inténtalo de nuevo.',
    )
  }
  return { movement, lot }
}

/** Gives the merma's pieces back to its lot; the ledger keeps both rows. */
async function giveBack(
  tx: Tx,
  actor: Actor,
  loss: Awaited<ReturnType<typeof openLoss>>,
  reason: string,
) {
  await appendMovement(tx, loss.lot, {
    type: 'loss',
    quantity: -loss.movement.quantity,
    reason,
    reference: voidedLossReference(loss.movement.id),
    actorId: actor.userId,
  })
}

/**
 * Owner «Editar merma»: corrects the pieces and motive of one merma row.
 * The ledger is append-only, so the old row is given back and a new one
 * replaces it on the same lot, pointing at the first registration.
 */
export async function editLoss(
  actor: Actor,
  input: LossEditInput,
): Promise<{ pieces: number }> {
  if (!isWholeNumber(input.pieces) || input.pieces < 1) {
    throw new AppError(
      'invalid',
      'Indica un número entero de piezas, de 1 en adelante.',
    )
  }
  assertFitsInt4(
    input.pieces,
    `La cantidad no puede ser mayor que ${MAX_INT4}.`,
  )
  if (!lossCategories.includes(input.category)) {
    throw new AppError('invalid', 'Selecciona el motivo de la merma.')
  }
  const note = input.note.trim()
  if (input.category === 'otro' && !note) {
    throw new AppError('invalid', 'Escribe el motivo de la merma.')
  }
  const reason = note ? `${input.category}: ${note}` : input.category
  return db.transaction(async (tx) => {
    const loss = await openLoss(tx, actor, input.movementId)
    const free = loss.lot.onHand - loss.lot.reserved - loss.movement.quantity
    if (input.pieces > free) {
      throw new AppError(
        'conflict',
        `El lote solo tiene ${free} ${free === 1 ? 'pieza disponible' : 'piezas disponibles'}.`,
      )
    }
    await giveBack(tx, actor, loss, 'Merma corregida')
    await appendMovement(tx, loss.lot, {
      type: 'loss',
      quantity: -input.pieces,
      reason,
      reference: editedLossReference(lossRootId(loss.movement)),
      actorId: actor.userId,
    })
    return { pieces: input.pieces }
  })
}

/** Owner «Anular merma»: every piece goes back to its lot. */
export async function voidLoss(
  actor: Actor,
  input: { movementId: string },
): Promise<{ pieces: number }> {
  return db.transaction(async (tx) => {
    const loss = await openLoss(tx, actor, input.movementId)
    await giveBack(tx, actor, loss, 'Merma anulada')
    return { pieces: -loss.movement.quantity }
  })
}

import type { LossCategory } from '#/modules/inventory/db/schema'
import { lossMotive } from '#/modules/inventory/lib/loss-ledger'

/**
 * How a corrected merma is told apart in the append-only ledger: the old
 * `loss` row is given back by a positive `loss` whose reference is
 * `void:<old id>`, and its replacement carries `edit:<first registration id>`.
 */
const voidPrefix = 'void:'
const editPrefix = 'edit:'

export const voidedLossReference = (movementId: string) =>
  `${voidPrefix}${movementId}`

export const editedLossReference = (rootId: string) => `${editPrefix}${rootId}`

/** Id of the merma's first registration, which keeps its date and author. */
export const lossRootId = (movement: {
  id: string
  reference: string | null
}) =>
  movement.reference?.startsWith(editPrefix)
    ? movement.reference.slice(editPrefix.length)
    : movement.id

/** Owner mermas only: rider settlements reference their assignment instead. */
export const isEditableLossReference = (reference: string | null) =>
  reference === null || reference.startsWith(editPrefix)

/** «Editar merma» starts from the row's current motive and note. */
export function lossEditDraft(reason: string): {
  category: LossCategory
  note: string
} {
  const motive = lossMotive(reason)
  if (motive.kind === 'dañado' || motive.kind === 'caducado') {
    return { category: motive.kind, note: motive.detail }
  }
  if (motive.kind === 'reparto') {
    return { category: 'dañado', note: motive.label }
  }
  return { category: 'otro', note: motive.label === 'Otro' ? '' : motive.label }
}

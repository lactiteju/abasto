import { fail } from '#/modules/inventory/lib/parsed'
import type { Parsed } from '#/modules/inventory/lib/parsed'

const INT4_MAX = 2147483647

/** An order line being edited; the quantity stays text while the user types. */
export type LineEdit = {
  presentationId: string
  productId: string
  /** Base units (pieces) in one presentation. */
  factor: number
  /** Quantity the order has today. */
  original: number
  quantity: string
}

export type EditPayload = {
  /** New total quantity per changed line; 0 removes it. */
  changes: Array<{ presentationId: string; quantity: number }>
  /** Units to add of products not in the order. */
  add: Array<{ presentationId: string; quantity: number }>
}

export const initialEdits = (
  lines: ReadonlyArray<{
    presentationId: string
    productId: string
    factor: number
    quantity: number
  }>,
): Array<LineEdit> =>
  lines.map((line) => ({
    presentationId: line.presentationId,
    productId: line.productId,
    factor: line.factor,
    original: line.quantity,
    quantity: String(line.quantity),
  }))

export const setEditQuantity = (
  edits: Array<LineEdit>,
  presentationId: string,
  quantity: string,
) =>
  edits.map((edit) =>
    edit.presentationId === presentationId ? { ...edit, quantity } : edit,
  )

/** Removing is quantity 0. */
export const removeEdit = (edits: Array<LineEdit>, presentationId: string) =>
  setEditQuantity(edits, presentationId, '0')

export const restoreEdit = (edits: Array<LineEdit>, presentationId: string) =>
  edits.map((edit) =>
    edit.presentationId === presentationId
      ? { ...edit, quantity: String(edit.original) }
      : edit,
  )

/** Whole quantity from 0 (remove) up to int4; null when it is not one. */
export function parseEditQuantity(text: string): number | null {
  const clean = text.trim()
  if (!/^\d+$/.test(clean)) return null
  const value = Number(clean)
  return value <= INT4_MAX ? value : null
}

export const isRemoved = (edit: LineEdit) =>
  parseEditQuantity(edit.quantity) === 0

/** Lines of the edit whose quantity differs from the order's today. */
export const isChanged = (edit: LineEdit) =>
  parseEditQuantity(edit.quantity) !== edit.original

/**
 * Base units each product frees (positive) or still needs (negative) once the
 * edited quantities are saved. Invalid text counts as unchanged.
 */
export function stockBalance(edits: ReadonlyArray<LineEdit>) {
  const balance = new Map<string, number>()
  for (const edit of edits) {
    const target = parseEditQuantity(edit.quantity) ?? edit.original
    const freed = (edit.original - target) * edit.factor
    if (freed)
      balance.set(edit.productId, (balance.get(edit.productId) ?? 0) + freed)
  }
  return balance
}

/**
 * The edit to send: changed lines (0 removes), plus the typed units to add.
 * Refuses invalid quantities, no changes, and an order left without products.
 */
export function draftToEdit(
  edits: ReadonlyArray<LineEdit>,
  adds: ReadonlyArray<{ presentationId: string; quantity: string }>,
): Parsed<EditPayload> {
  const changes: EditPayload['changes'] = []
  let remaining = 0
  for (const edit of edits) {
    const quantity = parseEditQuantity(edit.quantity)
    if (quantity === null) {
      return fail(
        'La cantidad de cada producto debe ser un entero de cero o más.',
      )
    }
    if (quantity > 0) remaining += 1
    if (quantity !== edit.original) {
      changes.push({ presentationId: edit.presentationId, quantity })
    }
  }
  const add: EditPayload['add'] = []
  for (const line of adds) {
    const quantity = parseEditQuantity(line.quantity)
    if (quantity === null || quantity < 1) {
      return fail(
        'La cantidad de cada producto debe ser un entero mayor que cero.',
      )
    }
    add.push({ presentationId: line.presentationId, quantity })
  }
  if (!changes.length && !add.length) return fail('No hay cambios que guardar.')
  if (remaining + add.length === 0) {
    return fail(
      'El pedido no puede quedar sin productos. Usa «Cancelar pedido» si ya no lo quieren.',
    )
  }
  return { ok: true, value: { changes, add } }
}

import {
  fail,
  parseWhole,
  wholeMessage,
} from '#/modules/riders/lib/assign-draft'
import type {
  AssignableProduct,
  AssignDraftLine,
  Parsed,
} from '#/modules/riders/lib/assign-draft'

/** A line already on the assignment, as the editor shows it. */
export type EditLoadLine = {
  productId: string
  productName: string
  boxFactor: number
  /** Base units currently assigned. */
  assignedQuantity: number
  /** New total as typed; starts as the current split. */
  boxes: string
  units: string
  /** «Quitar»: the whole line goes back to the warehouse. */
  removed: boolean
}

export type EditLoadInput = {
  assignmentId: string
  /** New TOTAL per existing product; 0 removes the line. */
  changes: Array<{ productId: string; boxes: number; units: number }>
  /** Units to ADD of products not on the assignment. */
  add: Array<{ productId: string; boxes: number; units: number }>
}

/**
 * Checks the editor the way the server will, with friendlier copy: only lines
 * whose total changed are sent; a raise cannot exceed what is available now.
 */
export function editLoadInputFromDraft(
  assignmentId: string,
  lines: ReadonlyArray<EditLoadLine>,
  added: ReadonlyArray<AssignDraftLine>,
  products: ReadonlyArray<AssignableProduct>,
): Parsed<EditLoadInput> {
  const changes: EditLoadInput['changes'] = []
  let remaining = 0
  for (const line of lines) {
    if (line.removed) {
      changes.push({ productId: line.productId, boxes: 0, units: 0 })
      continue
    }
    const boxes = parseWhole(line.boxes)
    const units = parseWhole(line.units)
    if (boxes === null || units === null) return fail(wholeMessage)
    const total = boxes * line.boxFactor + units
    if (total < 1) {
      return fail(
        `Indica cuántas cajas o unidades de ${line.productName}, o usa «Quitar».`,
      )
    }
    remaining += 1
    if (total === line.assignedQuantity) continue
    const available =
      products.find((p) => p.productId === line.productId)?.available ?? 0
    if (total - line.assignedQuantity > available) {
      return fail(
        `De ${line.productName} solo hay ${available} disponibles para sumar.`,
      )
    }
    changes.push({ productId: line.productId, boxes, units })
  }
  const taken = new Set(lines.map((line) => line.productId))
  const add: EditLoadInput['add'] = []
  for (const line of added) {
    if (!line.productId) return fail('Elige el producto de cada línea.')
    if (taken.has(line.productId)) {
      return fail('Ese producto ya está en el reparto: edita su cantidad.')
    }
    taken.add(line.productId)
    const product = products.find((p) => p.productId === line.productId)
    if (!product) return fail('Elige el producto de cada línea.')
    const boxes = parseWhole(line.boxes)
    const units = parseWhole(line.units)
    if (boxes === null || units === null) return fail(wholeMessage)
    const total = boxes * product.boxFactor + units
    if (total < 1) {
      return fail(`Indica cuántas cajas o unidades de ${product.name}.`)
    }
    if (total > product.available) {
      return fail(
        `De ${product.name} solo hay ${product.available} disponibles.`,
      )
    }
    add.push({ productId: line.productId, boxes, units })
    remaining += 1
  }
  if (!changes.length && !add.length) return fail('No hay cambios que guardar.')
  if (remaining === 0) {
    return fail(
      'El reparto no puede quedar sin productos. Si ya no sale, cancélalo desde el menú ⋯ del reparto.',
    )
  }
  return { ok: true, value: { assignmentId, changes, add } }
}

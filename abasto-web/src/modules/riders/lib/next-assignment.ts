import type {
  AssignableProduct,
  AssignDraftLine,
} from '#/modules/riders/lib/assign-draft'
import { splitBoxes } from '#/modules/riders/lib/box-quantities'
import type { AssignmentStatus } from '#/modules/riders/db/schema'

export type RowAction =
  'view' | 'recharge' | 'edit' | 'settle' | 'cancel' | 'prepareNext'

/** Actions the «⋯» menu of an assignment row offers; «Ver productos» always. */
export function rowActionsFor(status: AssignmentStatus): Array<RowAction> {
  if (status === 'En ruta') {
    return ['view', 'recharge', 'edit', 'settle', 'cancel']
  }
  if (status === 'Liquidada') return ['view', 'prepareNext']
  return ['view']
}

export const rowActionLabels: Record<RowAction, string> = {
  view: 'Ver productos',
  recharge: 'Recargar',
  edit: 'Editar carga',
  settle: 'Liquidar',
  cancel: 'Cancelar',
  prepareNext: 'Preparar siguiente reparto',
}

type SettledLine = {
  productId: string
  productName: string
  /** Base units that came back; null until settled. */
  leftoverQuantity: number | null
}

export type NextAssignmentPrefill = {
  lines: Array<AssignDraftLine>
  /** Products that came back but have less stock now (shown capped). */
  capped: Array<string>
  /** Products that came back but have no stock available now (left out). */
  unavailable: Array<string>
}

/**
 * The next assignment's starting lines: what came back from a settled one,
 * per product as boxes + units, never more than is available now.
 */
export function prefillFromSettlement(
  settledLines: ReadonlyArray<SettledLine>,
  products: ReadonlyArray<AssignableProduct>,
): NextAssignmentPrefill {
  const lines: Array<AssignDraftLine> = []
  const capped: Array<string> = []
  const unavailable: Array<string> = []
  for (const line of settledLines) {
    const back = line.leftoverQuantity ?? 0
    if (back < 1) continue
    const product = products.find((p) => p.productId === line.productId)
    if (!product || product.available < 1) {
      unavailable.push(line.productName)
      continue
    }
    const quantity = Math.min(back, product.available)
    if (quantity < back) capped.push(product.name)
    const { boxes, units } = splitBoxes(quantity, product.boxFactor)
    lines.push({
      productId: product.productId,
      boxes: boxes > 0 ? String(boxes) : '',
      units: units > 0 ? String(units) : '',
    })
  }
  return { lines, capped, unavailable }
}

/** Why the next assignment cannot be prepared for the rider, or null. */
export function prepareNextBlock(
  riderId: string,
  onRouteRiderIds: ReadonlySet<string>,
  riderActive: boolean,
): string | null {
  if (onRouteRiderIds.has(riderId)) {
    return 'Este repartidor ya tiene un reparto en ruta. Usa «Recargar» para agregarle producto.'
  }
  if (!riderActive) return 'Este repartidor está inactivo.'
  return null
}

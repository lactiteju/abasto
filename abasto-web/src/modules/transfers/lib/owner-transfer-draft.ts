import { filterProducts } from '#/lib/product-search'
import type { TransferableProduct } from '#/modules/transfers/services/owner-transfer'

/** Boxes typed per product id, as text. */
export type BoxQuantities = Readonly<Record<string, string>>

/** Keeps only digits and caps the number to what the origin has. */
export function clampBoxes(typed: string, available: number): string {
  const digits = typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return Number(digits) > available ? String(available) : digits
}

/** Lines with at least one box typed; zero and blank rows are only browsing. */
export function transferLines(
  quantities: BoxQuantities,
): Array<{ productId: string; boxes: number }> {
  return Object.entries(quantities).flatMap(([productId, typed]) => {
    const boxes = Number(typed)
    return Number.isInteger(boxes) && boxes > 0 ? [{ productId, boxes }] : []
  })
}

/** Products shown: search by name or SKU, optionally only the ones with boxes. */
export function visibleTransferProducts(
  products: ReadonlyArray<TransferableProduct>,
  query: string,
  onlyIds?: ReadonlySet<string>,
): Array<TransferableProduct> {
  const found = filterProducts(products, query)
  return onlyIds ? found.filter((p) => onlyIds.has(p.productId)) : found
}

/** «3 productos · 12 cajas». */
export function summarizeTransfer(
  lines: ReadonlyArray<{ boxes: number }>,
): string {
  if (!lines.length) return 'Sin productos'
  const boxes = lines.reduce((sum, line) => sum + line.boxes, 0)
  return `${lines.length} ${lines.length === 1 ? 'producto' : 'productos'} · ${boxes} ${boxes === 1 ? 'caja' : 'cajas'}`
}

/** «1 caja disponible» / «N cajas disponibles». */
export const boxesAvailableLabel = (boxes: number) =>
  `${boxes} ${boxes === 1 ? 'caja disponible' : 'cajas disponibles'}`

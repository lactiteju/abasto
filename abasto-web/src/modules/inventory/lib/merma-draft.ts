import { filterProducts } from '#/lib/product-search'

/** Pieces typed per product id, as text. */
export type PieceQuantities = Readonly<Record<string, string>>

/** Keeps only digits and caps the number to what is available. */
export function clampPieces(typed: string, available: number): string {
  const digits = typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return Number(digits) > available ? String(Math.max(0, available)) : digits
}

/** Lines with at least one piece typed; zero and blank rows are only browsing. */
export function mermaLines(
  quantities: PieceQuantities,
): Array<{ productId: string; pieces: number }> {
  return Object.entries(quantities).flatMap(([productId, typed]) => {
    const pieces = Number(typed)
    return Number.isInteger(pieces) && pieces > 0 ? [{ productId, pieces }] : []
  })
}

/** Products shown: search by name or SKU, optionally only the ones typed. */
export function visibleMermaProducts<
  T extends { name: string; sku: string; productId: string },
>(
  products: ReadonlyArray<T>,
  query: string,
  onlyIds?: ReadonlySet<string>,
): Array<T> {
  const found = filterProducts(products, query)
  return onlyIds ? found.filter((p) => onlyIds.has(p.productId)) : found
}

/** «1 pieza disponible» / «N piezas disponibles». */
export const piecesAvailableLabel = (pieces: number) =>
  `${pieces} ${pieces === 1 ? 'pieza disponible' : 'piezas disponibles'}`

/** «3 productos · 12 piezas». */
export function summarizeMerma(
  lines: ReadonlyArray<{ pieces: number }>,
): string {
  if (!lines.length) return 'Sin productos'
  const pieces = lines.reduce((sum, line) => sum + line.pieces, 0)
  return `${lines.length} ${lines.length === 1 ? 'producto' : 'productos'} · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`
}

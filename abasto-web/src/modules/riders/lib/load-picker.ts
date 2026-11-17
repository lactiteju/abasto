import { filterProducts } from '#/lib/product-search'
import { parseWhole } from '#/modules/riders/lib/assign-draft'
import type {
  AssignableProduct,
  AssignDraftLine,
} from '#/modules/riders/lib/assign-draft'

/** What was typed per product: boxes and units, as text. */
export type LoadQuantities = Partial<
  Record<string, { boxes: string; units: string }>
>

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/** Lines that have something typed; the rest of the table is just browsing. */
export function draftLines(quantities: LoadQuantities): Array<AssignDraftLine> {
  return Object.entries(quantities).flatMap(([productId, typed]) =>
    typed && (typed.boxes.trim() !== '' || typed.units.trim() !== '')
      ? [{ productId, boxes: typed.boxes, units: typed.units }]
      : [],
  )
}

/** «3 productos · 40 cajas y 20 unidades»; unreadable numbers count as zero. */
export function summarizeLoad(lines: ReadonlyArray<AssignDraftLine>): string {
  if (!lines.length) return 'Sin productos'
  let boxes = 0
  let units = 0
  for (const line of lines) {
    boxes += parseWhole(line.boxes) ?? 0
    units += parseWhole(line.units) ?? 0
  }
  const quantity = [
    ...(boxes > 0 ? [plural(boxes, 'caja', 'cajas')] : []),
    ...(units > 0 || boxes === 0 ? [plural(units, 'unidad', 'unidades')] : []),
  ].join(' y ')
  return `${plural(lines.length, 'producto', 'productos')} · ${quantity}`
}

/** «Disponible: 3 cajas y 4 piezas (40 piezas)», or just pieces for a box of one. */
export function availabilityLabel(
  product: Pick<AssignableProduct, 'available' | 'boxFactor'>,
): string {
  const pieces = plural(product.available, 'pieza', 'piezas')
  if (product.boxFactor <= 1 || product.available === 0) {
    return `Disponible: ${pieces}`
  }
  const boxes = Math.floor(product.available / product.boxFactor)
  const loose = product.available % product.boxFactor
  const parts = [
    plural(boxes, 'caja', 'cajas'),
    ...(loose ? [plural(loose, 'pieza', 'piezas')] : []),
  ]
  return `Disponible: ${parts.join(' y ')} (${pieces})`
}

/** «SKU · 12 piezas por caja · Proveedor»; blank parts are left out. */
export function productNote(
  product: Pick<AssignableProduct, 'sku' | 'boxFactor' | 'supplierName'>,
): string {
  return [
    product.sku,
    product.boxFactor > 1 ? `${product.boxFactor} piezas por caja` : null,
    product.supplierName,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Table rows: search by name or SKU, one supplier ("" = all), or only the typed ones. */
export function visibleProducts<T extends AssignableProduct>(
  products: ReadonlyArray<T>,
  {
    query,
    supplierId,
    onlyIds,
  }: { query: string; supplierId: string; onlyIds?: ReadonlySet<string> },
): Array<T> {
  return filterProducts(
    products.map((product) => ({ ...product, sku: product.sku ?? '' })),
    query,
  ).filter(
    (product) =>
      (!supplierId || product.supplierId === supplierId) &&
      (!onlyIds || onlyIds.has(product.productId)),
  )
}

import { formatQuantity } from '#/modules/inventory/lib/quantity'
import type { PackInfo } from '#/modules/inventory/lib/quantity'
import type { PdfDocument, PdfSection } from '#/modules/reports/lib/pdf-report'
import type { ProductStock } from '#/modules/inventory/services/stock-reads'

type CountPdfInput = {
  rows: ReadonlyArray<ProductStock>
  packs: ReadonlyMap<string, PackInfo>
  business: string
  warehouseName: string
  /** ISO day the sheet is printed: `2026-11-18`. */
  today: string
  /** Only this supplier; blank means all of them. */
  supplierId?: string
}

const noSupplier = 'Sin proveedor'
const collator = new Intl.Collator('es', { sensitivity: 'base' })

/** `2026-11-18` → `18/11/2026`. */
const dayLabel = (iso: string) => iso.split('-').reverse().join('/')

/** Nearest expiry among the lots that still hold stock. */
function nearestExpiry(row: ProductStock) {
  const days = row.lots
    .filter((lot) => lot.onHand > 0 && lot.expiresOn)
    .map((lot) => lot.expiresOn as string)
    .sort()
  return days.length ? dayLabel(days[0]) : '—'
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Whether the sheet would have any product to count. */
export function hasCountableStock(
  rows: ReadonlyArray<ProductStock>,
  supplierId = '',
) {
  return rows.some(
    (row) => row.onHand > 0 && (!supplierId || row.supplierId === supplierId),
  )
}

/**
 * The printable sheet for counting a warehouse by hand: products with stock,
 * one table per supplier, and a blank «Conteo» column to write in.
 */
export function buildInventoryCountPdf({
  rows,
  packs,
  business,
  warehouseName,
  today,
  supplierId = '',
}: CountPdfInput): PdfDocument {
  const groups = new Map<string, { name: string; rows: Array<ProductStock> }>()
  for (const row of rows) {
    if (row.onHand <= 0) continue
    if (supplierId && row.supplierId !== supplierId) continue
    const key = row.supplierId ?? ''
    const group = groups.get(key) ?? {
      name: row.supplierName ?? noSupplier,
      rows: [],
    }
    group.rows.push(row)
    groups.set(key, group)
  }
  const ordered = [...groups.values()].sort(
    (a, b) =>
      Number(a.name === noSupplier) - Number(b.name === noSupplier) ||
      collator.compare(a.name, b.name),
  )
  const sections = ordered.map((group): PdfSection => ({
    title: group.name,
    head: ['Producto', 'SKU', 'Existencia', 'Caducidad', 'Conteo'],
    rows: [...group.rows]
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((row) => [
        row.name,
        row.sku,
        formatQuantity(
          row.onHand,
          packs.get(row.productId) ?? {
            packName: row.unit,
            factor: 1,
            unit: row.unit,
          },
        ),
        nearestExpiry(row),
        '',
      ]),
    minRowHeight: 26,
  }))
  return {
    heading: `Conteo de inventario · ${warehouseName}`,
    lines: [`${business} · ${warehouseName}`, `Fecha: ${dayLabel(today)}`],
    filename: `inventario-${slug(warehouseName) || 'almacen'}-${today}.pdf`,
    footer: `${business} · Conteo de inventario`,
    sections,
  }
}

import { describe, expect, test } from 'bun:test'
import {
  buildInventoryCountPdf,
  hasCountableStock,
} from '#/modules/inventory/lib/inventory-count-pdf'
import type { ProductStock } from '#/modules/inventory/services/stock-reads'

const row = (over: Partial<ProductStock>): ProductStock => ({
  productId: over.name ?? 'Leche',
  name: 'Leche',
  sku: 'SKU',
  unit: 'pieza',
  imageUrl: null,
  supplierId: 's1',
  supplierName: 'Lala',
  onHand: 1,
  reserved: 0,
  inRoute: 0,
  expired: 0,
  available: 1,
  minimum: 0,
  belowMinimum: false,
  lots: [],
  ...over,
})

const base = {
  packs: new Map(),
  business: 'Distribuidora',
  warehouseName: 'Almacén Centro',
  today: '2026-11-18',
}

describe('buildInventoryCountPdf', () => {
  const rows = [
    row({ name: 'Yogurt', sku: 'Y1', supplierId: 's2', supplierName: 'Lala' }),
    row({ name: 'Crema', sku: 'C1', supplierId: 's1', supplierName: 'Alpura' }),
    row({ name: 'Queso', sku: 'Q1', supplierId: 's1', supplierName: 'Alpura' }),
    row({ name: 'Agotado', onHand: 0, supplierId: 's1' }),
    row({ name: 'Suelto', supplierId: null, supplierName: null }),
  ]

  test('groups by supplier, skips empty stock, sorts names', () => {
    const doc = buildInventoryCountPdf({ ...base, rows })
    expect(doc.sections.map((s) => s.title)).toEqual([
      'Alpura',
      'Lala',
      'Sin proveedor',
    ])
    expect(doc.sections[0].rows.map((r) => r[0])).toEqual(['Crema', 'Queso'])
    expect(doc.sections[0].head).toEqual([
      'Producto',
      'SKU',
      'Existencia',
      'Caducidad',
      'Conteo',
    ])
    expect(doc.sections[0].rows[0][4]).toBe('')
  })

  test('respects the supplier filter', () => {
    const doc = buildInventoryCountPdf({ ...base, rows, supplierId: 's2' })
    expect(doc.sections.map((s) => s.title)).toEqual(['Lala'])
  })

  test('shows boxes + pieces and the nearest expiry with stock', () => {
    const lot = (expiresOn: string | null, onHand: number) => ({
      id: 'l',
      code: 'L',
      expiresOn,
      receivedAt: new Date(0),
      onHand,
    })
    const doc = buildInventoryCountPdf({
      ...base,
      packs: new Map([
        ['Leche', { packName: 'caja', factor: 12, unit: 'pieza' }],
      ]),
      rows: [
        row({
          onHand: 14,
          lots: [
            lot('2026-11-01', 0),
            lot('2026-12-05', 8),
            lot('2026-12-01', 6),
          ],
        }),
        row({ name: 'Sin fecha', onHand: 2, lots: [lot(null, 2)] }),
      ],
    })
    const [leche, sinFecha] = doc.sections[0].rows
    expect(leche[2]).toBe('1 caja + 2 piezas')
    expect(leche[3]).toBe('01/12/2026')
    expect(sinFecha[3]).toBe('—')
  })

  test('header, filename and empty case', () => {
    const doc = buildInventoryCountPdf({ ...base, rows })
    expect(doc.lines).toEqual([
      'Distribuidora · Almacén Centro',
      'Fecha: 18/11/2026',
    ])
    expect(doc.filename).toBe('inventario-almacen-centro-2026-11-18.pdf')
    expect(
      buildInventoryCountPdf({ ...base, rows: [row({ onHand: 0 })] }).sections,
    ).toEqual([])
    expect(hasCountableStock([row({ onHand: 0 })])).toBe(false)
    expect(hasCountableStock(rows, 's2')).toBe(true)
    expect(hasCountableStock(rows, 'nope')).toBe(false)
  })
})

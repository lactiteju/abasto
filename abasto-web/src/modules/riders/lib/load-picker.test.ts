import { describe, expect, test } from 'bun:test'

import {
  availabilityLabel,
  draftLines,
  productNote,
  summarizeLoad,
  visibleProducts,
} from './load-picker'
import type { AssignableProduct } from './assign-draft'

const milk: AssignableProduct = {
  productId: 'milk',
  name: 'Leche Entera',
  sku: 'LE-1',
  supplierId: 's1',
  supplierName: 'Lala',
  boxFactor: 12,
  available: 100,
}
const cola: AssignableProduct = {
  productId: 'cola',
  name: 'Refresco',
  sku: 'RF-9',
  supplierId: 's2',
  supplierName: 'Alpura',
  boxFactor: 1,
  available: 1,
}

describe('draftLines', () => {
  test('keeps only lines with something typed', () => {
    expect(
      draftLines({
        milk: { boxes: '2', units: '' },
        cola: { boxes: '', units: ' ' },
        x: { boxes: '', units: '3' },
      }),
    ).toEqual([
      { productId: 'milk', boxes: '2', units: '' },
      { productId: 'x', boxes: '', units: '3' },
    ])
  })
})

describe('summarizeLoad', () => {
  test('counts products, boxes and units', () => {
    expect(
      summarizeLoad([
        { productId: 'a', boxes: '30', units: '' },
        { productId: 'b', boxes: '10', units: '12' },
        { productId: 'c', boxes: '', units: '8' },
      ]),
    ).toBe('3 productos · 40 cajas y 20 unidades')
  })

  test('singular, boxes only, units only and empty', () => {
    expect(summarizeLoad([{ productId: 'a', boxes: '1', units: '' }])).toBe(
      '1 producto · 1 caja',
    )
    expect(summarizeLoad([{ productId: 'a', boxes: '', units: '1' }])).toBe(
      '1 producto · 1 unidad',
    )
    expect(summarizeLoad([])).toBe('Sin productos')
  })

  test('unreadable numbers count as zero', () => {
    expect(summarizeLoad([{ productId: 'a', boxes: 'x', units: '2' }])).toBe(
      '1 producto · 2 unidades',
    )
  })
})

describe('availabilityLabel and productNote', () => {
  test('boxes with the pieces behind them', () => {
    expect(availabilityLabel(milk)).toBe(
      'Disponible: 8 cajas y 4 piezas (100 piezas)',
    )
    expect(availabilityLabel({ boxFactor: 12, available: 24 })).toBe(
      'Disponible: 2 cajas (24 piezas)',
    )
  })

  test('pieces only when the box is one piece', () => {
    expect(availabilityLabel(cola)).toBe('Disponible: 1 pieza')
  })

  test('note lists SKU, pieces per box and supplier', () => {
    expect(productNote(milk)).toBe('LE-1 · 12 piezas por caja · Lala')
    expect(productNote({ ...cola, supplierName: null })).toBe('RF-9')
  })
})

describe('visibleProducts', () => {
  const all = [milk, cola]
  test('filters by search (name or SKU), supplier and only-typed', () => {
    expect(visibleProducts(all, { query: '', supplierId: '' })).toHaveLength(2)
    expect(
      visibleProducts(all, { query: 'rf-9', supplierId: '' }).map(
        (p) => p.productId,
      ),
    ).toEqual(['cola'])
    expect(
      visibleProducts(all, { query: '', supplierId: 's1' }).map(
        (p) => p.productId,
      ),
    ).toEqual(['milk'])
    expect(
      visibleProducts(all, {
        query: '',
        supplierId: '',
        onlyIds: new Set(['cola']),
      }).map((p) => p.productId),
    ).toEqual(['cola'])
  })
})

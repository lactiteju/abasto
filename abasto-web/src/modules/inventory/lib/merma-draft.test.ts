import { describe, expect, test } from 'bun:test'
import {
  clampPieces,
  mermaLines,
  piecesAvailableLabel,
  summarizeMerma,
  visibleMermaProducts,
} from '#/modules/inventory/lib/merma-draft'

describe('clampPieces', () => {
  test('keeps digits only and caps to the available pieces', () => {
    expect(clampPieces('1a2', 50)).toBe('12')
    expect(clampPieces('99', 7)).toBe('7')
    expect(clampPieces('007', 50)).toBe('7')
    expect(clampPieces('abc', 5)).toBe('')
    expect(clampPieces('3', 0)).toBe('0')
  })
})

describe('mermaLines', () => {
  test('drops blank and zero rows', () => {
    expect(mermaLines({ a: '3', b: '', c: '0' })).toEqual([
      { productId: 'a', pieces: 3 },
    ])
  })
})

describe('labels', () => {
  test('pluralises', () => {
    expect(piecesAvailableLabel(1)).toBe('1 pieza disponible')
    expect(piecesAvailableLabel(8)).toBe('8 piezas disponibles')
    expect(summarizeMerma([])).toBe('Sin productos')
    expect(summarizeMerma([{ pieces: 1 }])).toBe('1 producto · 1 pieza')
    expect(summarizeMerma([{ pieces: 2 }, { pieces: 3 }])).toBe(
      '2 productos · 5 piezas',
    )
  })
})

describe('visibleMermaProducts', () => {
  const items = [
    { productId: '1', name: 'Leche', sku: 'LEC-1' },
    { productId: '2', name: 'Refresco', sku: 'REF-1' },
  ]
  test('searches by name or SKU and can keep only typed rows', () => {
    expect(visibleMermaProducts(items, 'ref-1')).toHaveLength(1)
    expect(visibleMermaProducts(items, '', new Set(['1']))[0]?.name).toBe(
      'Leche',
    )
  })
})

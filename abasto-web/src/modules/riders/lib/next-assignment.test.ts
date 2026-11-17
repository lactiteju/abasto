import { describe, expect, test } from 'bun:test'
import {
  prefillFromSettlement,
  prepareNextBlock,
  rowActionsFor,
} from '#/modules/riders/lib/next-assignment'

const milk = {
  productId: 'milk',
  name: 'Leche',
  boxFactor: 12,
  available: 100,
}

describe('rowActionsFor', () => {
  test('actions by state', () => {
    expect(rowActionsFor('En ruta')).toEqual([
      'recharge',
      'edit',
      'settle',
      'cancel',
    ])
    expect(rowActionsFor('Liquidada')).toEqual(['prepareNext'])
    expect(rowActionsFor('Cancelada')).toEqual([])
  })
})

describe('prefillFromSettlement', () => {
  const back = (productId: string, leftoverQuantity: number | null) => ({
    productId,
    productName: productId,
    leftoverQuantity,
  })

  test('expresses the returned quantity as boxes and units', () => {
    const result = prefillFromSettlement([back('milk', 30)], [milk])
    expect(result.lines).toEqual([
      { productId: 'milk', boxes: '2', units: '6' },
    ])
    expect(result.capped).toEqual([])
  })

  test('skips lines that returned nothing', () => {
    expect(
      prefillFromSettlement([back('milk', 0), back('milk', null)], [milk])
        .lines,
    ).toEqual([])
  })

  test('caps to current availability and reports it', () => {
    const result = prefillFromSettlement(
      [back('milk', 130)],
      [{ ...milk, available: 25 }],
    )
    expect(result.lines).toEqual([
      { productId: 'milk', boxes: '2', units: '1' },
    ])
    expect(result.capped).toEqual(['Leche'])
  })

  test('leaves out products with no stock now', () => {
    const result = prefillFromSettlement(
      [back('gone', 5), back('milk', 12)],
      [milk],
    )
    expect(result.unavailable).toEqual(['gone'])
    expect(result.lines).toEqual([{ productId: 'milk', boxes: '1', units: '' }])
  })

  test('a product without box shows only units', () => {
    const result = prefillFromSettlement(
      [back('milk', 7)],
      [{ ...milk, boxFactor: 1 }],
    )
    expect(result.lines).toEqual([{ productId: 'milk', boxes: '', units: '7' }])
  })
})

describe('prepareNextBlock', () => {
  test('explains a rider already on the road', () => {
    expect(prepareNextBlock('r1', new Set(['r1']), true)).toContain('Recargar')
  })
  test('free active rider is fine; inactive is not', () => {
    expect(prepareNextBlock('r1', new Set(), true)).toBeNull()
    expect(prepareNextBlock('r1', new Set(), false)).not.toBeNull()
  })
})

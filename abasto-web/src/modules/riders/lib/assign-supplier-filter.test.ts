import { describe, expect, test } from 'bun:test'
import {
  assignableSuppliers,
  defaultSupplierId,
  filterBySupplier,
} from '#/modules/riders/lib/assign-supplier-filter'

const p = (productId: string, supplierId: string | null, name = 'X') => ({
  productId,
  supplierId,
  supplierName: supplierId ? name : null,
})

describe('assignableSuppliers', () => {
  test('lists each supplier once by name, skipping products without one', () => {
    expect(
      assignableSuppliers([
        p('1', 's2', 'Lala'),
        p('2', 's1', 'Alpura'),
        p('3', 's2', 'Lala'),
        p('4', null),
      ]),
    ).toEqual([
      { id: 's1', name: 'Alpura', active: true },
      { id: 's2', name: 'Lala', active: true },
    ])
  })
})

describe('defaultSupplierId', () => {
  test('picks LALA regardless of case', () => {
    expect(
      defaultSupplierId([
        { id: 's1', name: 'Alpura' },
        { id: 's2', name: ' LaLa ' },
      ]),
    ).toBe('s2')
  })

  test('falls back to Todos when there is no LALA', () => {
    expect(defaultSupplierId([{ id: 's1', name: 'Alpura' }])).toBe('')
    expect(defaultSupplierId([])).toBe('')
  })
})

describe('filterBySupplier', () => {
  const list = [p('1', 's1'), p('2', 's2'), p('3', null)]

  test('Todos keeps everything', () => {
    expect(filterBySupplier(list, '')).toHaveLength(3)
  })

  test('narrows to the supplier', () => {
    expect(filterBySupplier(list, 's2').map((x) => x.productId)).toEqual(['2'])
  })

  test('keeps products already chosen', () => {
    expect(filterBySupplier(list, 's2', ['1']).map((x) => x.productId)).toEqual(
      ['1', '2'],
    )
  })
})

import { describe, expect, test } from 'bun:test'
import {
  EMPTY_ORDER_MESSAGE,
  discountReopenNote,
  draftFromOrder,
  editInputFromDraft,
  productsForEdit,
} from '#/modules/inventory/lib/supplier-order-edit-draft'
import type { EditableLine } from '#/modules/inventory/lib/supplier-order-edit-draft'
import {
  NET_ABOVE_LIST_PRICE_MESSAGE,
  boxFactorOf,
  orderTotalCents,
} from '#/modules/inventory/lib/supplier-order-draft'
import type { OrderProduct } from '#/modules/inventory/lib/supplier-order-draft'

const box = (factor: number) => [
  { factor: 1, active: true, isDefault: false },
  { factor, active: true, isDefault: true },
]
const milk: OrderProduct = {
  id: 'milk',
  name: 'Leche',
  sku: 'M',
  supplierId: 's1',
  listPricePerPiece: 20000,
  fixedDiscountPerPiece: 0,
  promotionPerPiece: 0,
  presentations: box(12),
}
const soda: OrderProduct = { ...milk, id: 'soda', name: 'Refresco', sku: 'R' }

/** Milk was ordered when it cost 12 000 a piece with a 500 discount, in boxes of 6. */
const milkLine: EditableLine = {
  productId: 'milk',
  boxes: 3,
  boxFactor: 6,
  listPricePerPiece: 12000,
  fixedDiscountPerPiece: 500,
  promotionPerPiece: 0,
}
const order = {
  supplierId: 's1',
  warehouseId: 'w1',
  expectedOn: '2026-11-20',
  lines: [milkLine],
}

describe('draftFromOrder', () => {
  test('prefills the boxes of every line and the order data', () => {
    expect(draftFromOrder(order)).toEqual({
      supplierId: 's1',
      warehouseId: 'w1',
      expectedOn: '2026-11-20',
      boxes: { milk: '3' },
    })
    expect(draftFromOrder({ ...order, expectedOn: null }).expectedOn).toBe('')
  })
})

describe('productsForEdit', () => {
  test('lines on the order keep their frozen terms and factor; others stay as in the catalog', () => {
    const [editedMilk, editedSoda] = productsForEdit([milk, soda], [milkLine])
    expect(editedMilk).toMatchObject({
      listPricePerPiece: 12000,
      fixedDiscountPerPiece: 500,
    })
    expect(boxFactorOf(editedMilk)).toBe(6)
    expect(editedSoda).toBe(soda)
    // 3 boxes × 6 pieces × (12000 − 500) / 10000 = 20.70 → 2070 cents
    expect(
      orderTotalCents([editedMilk, editedSoda], { boxes: { milk: '3' } }),
    ).toBe(2070)
  })
})

describe('editInputFromDraft', () => {
  const draft = draftFromOrder(order)

  test('raises, lowers, removes and adds by the typed boxes', () => {
    const result = editInputFromDraft(
      'p1',
      { ...draft, boxes: { milk: '5', soda: '2' } },
      [milk, soda],
    )
    expect(result).toEqual({
      ok: true,
      value: {
        purchaseId: 'p1',
        lines: [
          { productId: 'milk', boxes: 5 },
          { productId: 'soda', boxes: 2 },
        ],
      },
    })
    const removed = editInputFromDraft(
      'p1',
      { ...draft, boxes: { milk: '', soda: '1' } },
      [milk, soda],
    )
    expect(removed).toMatchObject({
      ok: true,
      value: { lines: [{ productId: 'soda', boxes: 1 }] },
    })
  })

  test('no lines left suggests cancelling the order', () => {
    const result = editInputFromDraft(
      'p1',
      { ...draft, boxes: { milk: '0' } },
      [milk],
    )
    expect(result).toEqual({ ok: false, message: EMPTY_ORDER_MESSAGE })
    expect(EMPTY_ORDER_MESSAGE).toContain('Cancelar pedido')
  })

  test('a bad row names its product', () => {
    expect(
      editInputFromDraft('p1', { ...draft, boxes: { milk: '1.5' } }, [milk]),
    ).toMatchObject({ ok: false, productId: 'milk' })
    const priced = { ...milk, fixedDiscountPerPiece: 30000 }
    expect(
      editInputFromDraft('p1', { ...draft, boxes: { milk: '1' } }, [priced]),
    ).toMatchObject({
      ok: false,
      productId: 'milk',
      message: `Leche: ${NET_ABOVE_LIST_PRICE_MESSAGE}`,
    })
  })

  test('lines whose product is not shown are kept, never dropped silently', () => {
    const result = editInputFromDraft(
      'p1',
      { ...draft, boxes: { gone: '4', milk: '1' } },
      [milk],
    )
    expect(result).toMatchObject({
      ok: true,
      value: {
        lines: [
          { productId: 'milk', boxes: 1 },
          { productId: 'gone', boxes: 4 },
        ],
      },
    })
    expect(
      editInputFromDraft('p1', { ...draft, boxes: { gone: '4' } }, []),
    ).toMatchObject({
      ok: true,
      value: { lines: [{ productId: 'gone', boxes: 4 }] },
    })
  })
})

describe('discountReopenNote', () => {
  test('warns only when the applied discounts exceed the new total', () => {
    expect(discountReopenNote(4032, 2688)).toContain('se reabrirán')
    expect(discountReopenNote(2688, 2688)).toBeNull()
    expect(discountReopenNote(0, 0)).toBeNull()
  })
})

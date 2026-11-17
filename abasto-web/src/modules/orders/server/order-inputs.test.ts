import { describe, expect, test } from 'bun:test'
import { parseInput } from '#/lib/boundary'
import { AppError } from '#/lib/errors'
import {
  createOrderInput,
  editOrderInput,
  orderIdInput,
  pickupOrderInput,
  quoteOrderInput,
  sellOrderInput,
  reservationHoursInput,
} from '#/modules/orders/server/order-inputs'

const fails = (schema: Parameters<typeof parseInput>[0], data: unknown) => {
  try {
    parseInput(schema, data)
  } catch (error) {
    return error instanceof AppError && error.code === 'invalid'
  }
  return false
}

const order = {
  warehouseId: 'w1',
  customerId: 'c1',
  lines: [{ presentationId: 'p1', quantity: 3 }],
}

describe('order server function inputs', () => {
  test('create takes warehouse, customer, optional notes and whole-quantity lines', () => {
    expect(parseInput(createOrderInput, order)).toEqual(order)
    expect(
      parseInput(createOrderInput, { ...order, notes: 'Pasa a las 5' }).notes,
    ).toBe('Pasa a las 5')
  })

  test('create rejects malformed shapes (business rules stay in the service)', () => {
    expect(fails(createOrderInput, { ...order, customerId: undefined })).toBe(
      true,
    )
    expect(fails(createOrderInput, { ...order, lines: 'x' })).toBe(true)
    expect(
      fails(createOrderInput, {
        ...order,
        lines: [{ presentationId: 'p1', quantity: 1.5 }],
      }),
    ).toBe(true)
    expect(
      fails(createOrderInput, {
        ...order,
        lines: [{ presentationId: 'p1', quantity: '2' }],
      }),
    ).toBe(true)
    expect(fails(createOrderInput, { ...order, notes: 5 })).toBe(true)
  })

  test('actions take an order id', () => {
    expect(parseInput(orderIdInput, { orderId: 'o1' })).toEqual({
      orderId: 'o1',
    })
    expect(fails(orderIdInput, {})).toBe(true)
    expect(fails(orderIdInput, { orderId: '' })).toBe(true)
  })

  test('reservation hours is an integer (range stays in the service)', () => {
    expect(parseInput(reservationHoursInput, { hours: 24 })).toEqual({
      hours: 24,
    })
    expect(fails(reservationHoursInput, { hours: 1.5 })).toBe(true)
    expect(fails(reservationHoursInput, { hours: '24' })).toBe(true)
  })

  test('a quote takes the order lines and drops notes', () => {
    expect(parseInput(quoteOrderInput, { ...order, notes: 'x' })).toEqual(order)
    expect(fails(quoteOrderInput, { warehouseId: 'w1' })).toBe(true)
  })

  test('pickup takes an order id and an optional cash payment', () => {
    expect(parseInput(pickupOrderInput, { orderId: 'o1' })).toEqual({
      orderId: 'o1',
    })
    const cash = { terms: 'contado' as const, tenderedCents: 5000 }
    expect(
      parseInput(pickupOrderInput, { orderId: 'o1', payment: cash }).payment,
    ).toEqual(cash)
    for (const payment of [
      { terms: 'credito' },
      { terms: 'tarjeta' },
      { terms: 'contado' },
      { terms: 'contado', tenderedCents: 1.5 },
      { terms: 'contado', tenderedCents: '5' },
    ]) {
      expect(fails(pickupOrderInput, { orderId: 'o1', payment })).toBe(true)
    }
    expect(fails(pickupOrderInput, { payment: cash })).toBe(true)
  })

  test('edit takes new totals (0 allowed) and units to add, whole numbers only', () => {
    const edit = {
      orderId: 'o1',
      changes: [{ presentationId: 'p1', quantity: 0 }],
      add: [{ presentationId: 'p2', quantity: 2 }],
    }
    expect(parseInput(editOrderInput, edit)).toEqual(edit)
    expect(fails(editOrderInput, { ...edit, add: undefined })).toBe(true)
    expect(
      fails(editOrderInput, {
        ...edit,
        changes: [{ presentationId: 'p1', quantity: 1.5 }],
      }),
    ).toBe(true)
  })
})

describe('sell input', () => {
  test('takes the order and an optional payment (the service judges it)', () => {
    const payment = { terms: 'contado' as const, tenderedCents: 3000 }
    const sale = { ...order, expectedTotalCents: 3000 }
    expect(parseInput(sellOrderInput, { ...sale, payment })).toEqual({
      ...sale,
      payment,
    })
    expect(parseInput(sellOrderInput, sale).payment).toBeUndefined()
  })

  test('rejects malformed shapes', () => {
    const sale = { ...order, expectedTotalCents: 3000 }
    expect(fails(sellOrderInput, { ...sale, customerId: undefined })).toBe(true)
    expect(
      fails(sellOrderInput, { ...sale, payment: { terms: 'credito' } }),
    ).toBe(true)
    expect(fails(sellOrderInput, order)).toBe(true)
    expect(fails(sellOrderInput, { ...sale, expectedTotalCents: 30.5 })).toBe(
      true,
    )
    expect(
      fails(sellOrderInput, { ...sale, expectedTotalCents: undefined }),
    ).toBe(true)
  })
})

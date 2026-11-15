import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import {
  cancelOrder,
  pickupOrder,
} from '#/modules/orders/services/order-actions'
import { addToReservedOrder } from '#/modules/orders/services/order-edit'
import { getOrder } from '#/modules/orders/services/order-reads'
import { createOrder } from '#/modules/orders/services/orders'
import {
  advance,
  errorOf,
  orderState,
  payCash,
  receive,
  setupOrders,
  useClock,
} from '#/modules/orders/services/testing'
import { setPrices } from '#/modules/pricing/services/prices'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

type Fx = Awaited<ReturnType<typeof setupOrders>>
const line = (presentationId: string, quantity: number) => ({
  presentationId,
  quantity,
})
const place = (fx: Fx, lines: Array<ReturnType<typeof line>>) =>
  createOrder(fx.staffA, {
    warehouseId: fx.a.id,
    customerId: fx.customer.id,
    lines,
  })

async function rejects(
  run: () => Promise<unknown>,
  code: string,
  message: string,
) {
  const before = await orderState()
  const error = await errorOf(run)
  expect([error.code, error.message]).toEqual([code, message])
  expect(await orderState()).toEqual(before)
}

describe('addToReservedOrder', () => {
  test('raises a line: same frozen price, FIFO allocations, lots and total follow', async () => {
    const fx = await setupOrders()
    const first = await receive(fx, { productId: fx.milkBox.id, quantity: 24 })
    const second = await receive(fx, {
      productId: fx.milkBox.id,
      quantity: 24,
      expiresOn: '2099-01-01',
    })
    const order = await place(fx, [line(fx.boxId, 1)]) // 12 pieces from first
    const edited = await addToReservedOrder(fx.staffA, {
      orderId: order.id,
      lines: [line(fx.boxId, 2)], // 24 more: 12 left in first, 12 in second
    })
    expect(edited.status).toBe('Reservado')
    expect(edited.lines).toHaveLength(1)
    expect(edited.lines[0]).toMatchObject({
      quantity: 3,
      baseQuantity: 36,
      unitPriceCents: 12000,
      lineTotalCents: 36000,
    })
    expect(edited.totalCents).toBe(36000)
    const taken = new Map<string, number>()
    for (const a of edited.lines[0].allocations) {
      taken.set(a.lotId, (taken.get(a.lotId) ?? 0) + a.quantity)
    }
    expect(Object.fromEntries(taken)).toEqual({
      [first.id]: 24,
      [second.id]: 12,
    })
    const lots = (await orderState()).lots
    expect(lots.find((l) => l.id === first.id)?.reserved).toBe(24)
    expect(lots.find((l) => l.id === second.id)?.reserved).toBe(12)
    expect(await getOrder(fx.staffA, order.id)).toEqual(edited)
  })

  test('keeps the frozen price of the line even if the list price changed', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.pieceId, priceCents: 5000 }],
    })
    const edited = await addToReservedOrder(fx.staffA, {
      orderId: order.id,
      lines: [line(fx.pieceId, 3)],
    })
    expect(edited.lines[0]).toMatchObject({
      quantity: 5,
      unitPriceCents: 1000,
      lineTotalCents: 5000,
    })
    expect(edited.totalCents).toBe(5000)
  })

  test('adds a new product line quoted at the current price', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const colaLot = await receive(fx, { productId: fx.cola.id, quantity: 30 })
    const colaPiece = fx.piece(fx.cola).id
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: colaPiece, priceCents: 700 }],
    })
    const order = await place(fx, [line(fx.pieceId, 4)])
    const edited = await addToReservedOrder(fx.staffA, {
      orderId: order.id,
      lines: [line(colaPiece, 5)],
    })
    expect(edited.lines).toHaveLength(2)
    const added = edited.lines.find((l) => l.presentationId === colaPiece)!
    expect(added).toMatchObject({
      quantity: 5,
      unitPriceCents: 700,
      lineTotalCents: 3500,
    })
    expect(added.allocations).toEqual([
      expect.objectContaining({ lotId: colaLot.id, quantity: 5 }),
    ])
    expect(edited.totalCents).toBe(4000 + 3500)
    expect(
      (await orderState()).lots.find((l) => l.id === colaLot.id)?.reserved,
    ).toBe(5)
  })

  test('rejects without enough stock and changes nothing', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 20 })
    const order = await place(fx, [line(fx.pieceId, 15)])
    await rejects(
      () =>
        addToReservedOrder(fx.staffA, {
          orderId: order.id,
          lines: [line(fx.pieceId, 6)],
        }),
      'conflict',
      'No hay suficiente existencia disponible de Leche entera 1L.',
    )
  })

  test('a shortage on a later line rolls back the earlier ones', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    const colaPiece = fx.piece(fx.cola).id
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: colaPiece, priceCents: 700 }],
    })
    await rejects(
      () =>
        addToReservedOrder(fx.staffA, {
          orderId: order.id,
          lines: [line(fx.pieceId, 1), line(colaPiece, 1)],
        }),
      'conflict',
      'No hay suficiente existencia disponible de Cola 600ml.',
    )
  })

  test('only Reservado orders can be edited', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    await cancelOrder(fx.staffA, order.id)
    await rejects(
      () =>
        addToReservedOrder(fx.staffA, {
          orderId: order.id,
          lines: [line(fx.pieceId, 1)],
        }),
      'conflict',
      'Solo se puede editar un pedido reservado.',
    )
  })

  test('an expired order cannot be edited', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    advance(48)
    const error = await errorOf(() =>
      addToReservedOrder(fx.staffA, {
        orderId: order.id,
        lines: [line(fx.pieceId, 1)],
      }),
    )
    expect([error.code, error.message]).toEqual([
      'conflict',
      'El pedido venció y se liberó el producto. Crea un pedido nuevo.',
    ])
    const state = await orderState()
    expect(state.orders[0].status).toBe('Vencido')
    expect(state.lots[0].reserved).toBe(0)
  })

  test('needs permission on the order warehouse', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    await rejects(
      () =>
        addToReservedOrder(fx.managerB, {
          orderId: order.id,
          lines: [line(fx.pieceId, 1)],
        }),
      'forbidden',
      'No tienes permiso para esta acción.',
    )
  })

  test('validates quantities and unknown orders', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 50 })
    const order = await place(fx, [line(fx.pieceId, 2)])
    await rejects(
      () =>
        addToReservedOrder(fx.staffA, {
          orderId: order.id,
          lines: [line(fx.pieceId, 0)],
        }),
      'invalid',
      'La cantidad de cada producto debe ser un entero mayor que cero.',
    )
    await rejects(
      () =>
        addToReservedOrder(fx.staffA, {
          orderId: '00000000-0000-4000-8000-000000000000',
          lines: [line(fx.pieceId, 1)],
        }),
      'not_found',
      'No encontramos ese pedido.',
    )
  })

  test('cancel after an edit releases every reserved unit, pickup consumes them all', async () => {
    const fx = await setupOrders()
    const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 48 })
    const reserved = async () =>
      (await orderState()).lots.find((l) => l.id === lot.id)
    const cancelled = await place(fx, [line(fx.boxId, 1)])
    await addToReservedOrder(fx.staffA, {
      orderId: cancelled.id,
      lines: [line(fx.boxId, 1)],
    })
    expect(await reserved()).toMatchObject({ onHand: 48, reserved: 24 })
    await cancelOrder(fx.staffA, cancelled.id)
    expect(await reserved()).toMatchObject({ onHand: 48, reserved: 0 })

    const picked = await place(fx, [line(fx.boxId, 1)])
    await addToReservedOrder(fx.staffA, {
      orderId: picked.id,
      lines: [line(fx.boxId, 2)],
    })
    await pickupOrder(fx.staffA, picked.id, payCash)
    expect(await reserved()).toMatchObject({ onHand: 12, reserved: 0 })
  })
})

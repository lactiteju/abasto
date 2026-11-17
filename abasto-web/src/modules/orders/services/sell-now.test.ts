import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { cashMovements } from '#/modules/cash/db/schema'
import { closeCashSession } from '#/modules/cash/services/cash-sessions'
import { paymentState } from '#/modules/cash/services/testing'
import { updateCustomer } from '#/modules/customers/services/customers'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { orders } from '#/modules/orders/db/schema'
import { createOrder } from '#/modules/orders/services/orders'
import { getOrder } from '#/modules/orders/services/order-reads'
import { sellNow } from '#/modules/orders/services/sell-now'
import {
  errorOf,
  payCash,
  receive,
  setupOrders,
  useClock,
} from '#/modules/orders/services/testing'
import { setPrices } from '#/modules/pricing/services/prices'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

const cash = (tenderedCents: number) => ({
  terms: 'contado' as const,
  tenderedCents,
})

async function setup(quantity = 20) {
  const fx = await setupOrders()
  const lot = await receive(fx, { productId: fx.milkBox.id, quantity })
  const sell = (
    pieces: number,
    payment: Parameters<typeof sellNow>[2] = payCash,
    actor = fx.staffA,
  ) =>
    sellNow(
      actor,
      {
        warehouseId: fx.a.id,
        customerId: fx.customer.id,
        lines: [{ presentationId: fx.pieceId, quantity: pieces }],
      },
      payment,
    )
  const lotRow = async () =>
    (await db.select().from(lots).where(eq(lots.id, lot.id)))[0]
  return { fx, lot, sell, lotRow }
}

describe('sellNow', () => {
  test('creates a delivered order with payment, cash movement and stock out', async () => {
    const { fx, lot, sell, lotRow } = await setup()
    const sold = await sell(3, cash(5000))
    expect(sold).toMatchObject({
      status: 'Recogido',
      totalCents: 3000,
      customerId: fx.customer.id,
      payment: { terms: 'contado', tenderedCents: 5000, changeCents: 2000 },
    })
    expect(sold.lines[0]).toMatchObject({
      quantity: 3,
      unitPriceCents: 1000,
      lineTotalCents: 3000,
    })
    expect(await lotRow()).toMatchObject({ onHand: 17, reserved: 0 })
    const [sale] = await db.select().from(cashMovements)
    expect(sale).toMatchObject({
      type: 'sale',
      amountCents: 3000,
      tenderedCents: 5000,
      changeCents: 2000,
      orderId: sold.id,
      customerId: fx.customer.id,
      actorId: fx.staffA.userId,
    })
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.reference, sold.id))
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      type: 'sale',
      quantity: -3,
      lotId: lot.id,
    })
    const stored = await getOrder(fx.staffA, sold.id)
    expect(stored.status).toBe('Recogido')
    expect(stored.closedAt).not.toBeNull()
  })

  test('freezes the quoted prices: later price changes do not touch it', async () => {
    const { fx, sell } = await setup()
    const sold = await sell(2)
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.pieceId, priceCents: 5000 }],
    })
    const stored = await getOrder(fx.staffA, sold.id)
    expect(stored.totalCents).toBe(2000)
    expect(stored.lines[0].unitPriceCents).toBe(1000)
  })

  test('sells by the box and the piece in one order', async () => {
    const { fx, lotRow } = await setup()
    const sold = await sellNow(
      fx.staffA,
      {
        warehouseId: fx.a.id,
        customerId: fx.customer.id,
        lines: [
          { presentationId: fx.boxId, quantity: 1 },
          { presentationId: fx.pieceId, quantity: 2 },
        ],
      },
      payCash,
    )
    expect(sold.totalCents).toBe(14000)
    expect(await lotRow()).toMatchObject({ onHand: 6, reserved: 0 })
  })

  test('unrelated reservations keep their reserved units', async () => {
    const { fx, sell, lotRow } = await setup()
    const held = await createOrder(fx.staffA, {
      warehouseId: fx.a.id,
      customerId: fx.customer.id,
      lines: [{ presentationId: fx.pieceId, quantity: 5 }],
    })
    await sell(4)
    expect(await lotRow()).toMatchObject({ onHand: 16, reserved: 5 })
    expect((await getOrder(fx.staffA, held.id)).status).toBe('Reservado')
  })
})

describe('sellNow refusals roll everything back', () => {
  test('closed cash drawer', async () => {
    const { fx, sell } = await setup()
    await closeCashSession(fx.staffA, { warehouseId: fx.a.id, countedCents: 0 })
    const before = await paymentState()
    const error = await errorOf(() => sell(3))
    expect([error.code, error.message]).toEqual([
      'conflict',
      'Abre la caja antes de cobrar.',
    ])
    expect(await paymentState()).toEqual(before)
  })

  test('short stock', async () => {
    const { sell } = await setup(5)
    const before = await paymentState()
    const error = await errorOf(() => sell(6))
    expect([error.code, error.message]).toEqual([
      'conflict',
      'No hay suficiente existencia disponible de Leche entera 1L.',
    ])
    expect(await paymentState()).toEqual(before)
  })

  test('bad, missing or insufficient payment', async () => {
    const { sell } = await setup()
    const before = await paymentState()
    const none = await errorOf(() => sell(3, null as never))
    expect([none.code, none.message]).toEqual([
      'invalid',
      'Elige cómo se paga el pedido.',
    ])
    const short = await errorOf(() => sell(3, cash(2999)))
    expect([short.code, short.message]).toEqual([
      'conflict',
      'El efectivo recibido no cubre el total del pedido.',
    ])
    for (const bad of [
      cash(Number.NaN),
      cash(-1),
      cash(3000.5),
      cash(2 ** 40),
    ]) {
      expect((await errorOf(() => sell(3, bad))).code).toBe('invalid')
    }
    expect(
      (await errorOf(() => sell(3, { terms: 'credito' } as never))).message,
    ).toBe('Elige cómo se paga el pedido.')
    expect(await paymentState()).toEqual(before)
  })

  test('inactive customer', async () => {
    const { fx, sell } = await setup()
    await updateCustomer(fx.owner, fx.customer.id, { active: false })
    const before = await paymentState()
    const error = await errorOf(() => sell(3))
    expect([error.code, error.message]).toEqual([
      'conflict',
      'Este cliente está inactivo.',
    ])
    expect(await paymentState()).toEqual(before)
  })

  test('unknown customer, empty and duplicated lines', async () => {
    const { fx, sell } = await setup()
    const before = await paymentState()
    expect(
      (
        await errorOf(() =>
          sellNow(
            fx.staffA,
            { warehouseId: fx.a.id, customerId: '', lines: [] },
            payCash,
          ),
        )
      ).code,
    ).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          sellNow(
            fx.staffA,
            {
              warehouseId: fx.a.id,
              customerId: fx.customer.id,
              lines: [
                { presentationId: fx.pieceId, quantity: 1 },
                { presentationId: fx.pieceId, quantity: 1 },
              ],
            },
            payCash,
          ),
        )
      ).code,
    ).toBe('invalid')
    expect((await errorOf(() => sell(0))).code).toBe('invalid')
    expect(await paymentState()).toEqual(before)
  })

  test('a user without access to the warehouse is forbidden and nothing changes', async () => {
    const { fx, sell } = await setup()
    const before = await paymentState()
    const error = await errorOf(() => sell(1, payCash, fx.managerB))
    expect(error.code).toBe('forbidden')
    expect(await paymentState()).toEqual(before)
    expect(await db.select().from(orders)).toHaveLength(0)
  })
})

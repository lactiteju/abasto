import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { cashMovements } from '#/modules/cash/db/schema'
import {
  closeCashSession,
  getOpenCashSession,
  openCashSession,
} from '#/modules/cash/services/cash-sessions'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { orders } from '#/modules/orders/db/schema'
import { pickupOrder } from '#/modules/orders/services/order-actions'
import { editReservedOrder } from '#/modules/orders/services/order-edit'
import { reopenSale } from '#/modules/orders/services/reopen-sale'
import { expireOverdueOrders } from '#/modules/orders/services/expiry'
import {
  advance,
  errorOf,
  orderState,
  payCash,
  setupOrders,
  receive,
  useClock,
} from '#/modules/orders/services/testing'
import { createOrder } from '#/modules/orders/services/orders'
import { getSalesReport } from '#/modules/reports/services/sales-report'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

const drawerMessage = 'Abre la caja para reabrir la venta.'
const wide = {
  period: { preset: 'custom' as const, from: '2026-01-01', to: '2026-12-31' },
}

async function setup() {
  const fx = await setupOrders()
  const first = await receive(fx, { productId: fx.milkBox.id, quantity: 6 })
  const second = await receive(fx, {
    productId: fx.milkBox.id,
    quantity: 10,
    expiresOn: '2099-01-01',
  })
  const sold = async (quantity: number) => {
    const order = await createOrder(fx.staffA, {
      warehouseId: fx.a.id,
      customerId: fx.customer.id,
      lines: [{ presentationId: fx.pieceId, quantity }],
    })
    await pickupOrder(fx.staffA, order.id, payCash)
    return order
  }
  const lotRows = async () =>
    db
      .select({ id: lots.id, onHand: lots.onHand, reserved: lots.reserved })
      .from(lots)
      .orderBy(asc(lots.id))
  return { fx, first, second, sold, lotRows }
}

const drawer = async (fx: Awaited<ReturnType<typeof setup>>['fx']) =>
  (await getOpenCashSession(fx.staffA, fx.a.id))!

describe('reopenSale', () => {
  test('returns the units to the same lots as reserved and records reversing movements', async () => {
    const { fx, sold, lotRows } = await setup()
    const order = await sold(9)
    const afterSale = await lotRows()
    expect(afterSale.reduce((n, l) => n + l.onHand, 0)).toBe(7)
    expect(afterSale.every((l) => l.reserved === 0)).toBe(true)

    const reopened = await reopenSale(fx.owner, order.id)
    expect(reopened.status).toBe('Reservado')
    const after = await lotRows()
    expect(after.reduce((n, l) => n + l.onHand, 0)).toBe(16)
    expect(after.reduce((n, l) => n + l.reserved, 0)).toBe(9)
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.reference, order.id))
      .orderBy(asc(stockMovements.createdAt))
    const sales = movements.filter((m) => m.type === 'sale')
    expect(sales.reduce((n, m) => n + m.quantity, 0)).toBe(0)
    expect(sales.filter((m) => m.quantity > 0)).toHaveLength(2)
    const row = (
      await db.select().from(orders).where(eq(orders.id, order.id))
    )[0]
    expect(row).toMatchObject({
      status: 'Reservado',
      closedAt: null,
      reopenCount: 1,
      reopenedBy: fx.owner.userId,
    })
    expect(row.reopenedAt).toBeInstanceOf(Date)
  })

  test('posts the cash outflow in the open drawer and keeps the sale row', async () => {
    const { fx, sold } = await setup()
    const order = await sold(3)
    await reopenSale(fx.owner, order.id)
    const movements = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.orderId, order.id))
      .orderBy(asc(cashMovements.createdAt))
    expect(movements.map((m) => [m.type, m.amountCents])).toEqual([
      ['sale', 3000],
      ['withdrawal', -3000],
    ])
    expect(movements[1].reason).toBe(
      `Venta reabierta PED-${order.id.slice(0, 8).toUpperCase()}`,
    )
    const session = await drawer(fx)
    expect(session.movements.reduce((n, m) => n + m.amountCents, 0)).toBe(0)
  })

  test('a manager is forbidden and nothing changes', async () => {
    const { fx, sold } = await setup()
    const order = await sold(3)
    const before = await orderState()
    const error = await errorOf(() => reopenSale(fx.staffA, order.id))
    expect(error).toMatchObject({
      code: 'forbidden',
      message: 'No tienes permiso para esta acción.',
    })
    expect(await orderState()).toEqual(before)
  })

  test('needs an open drawer in the order warehouse', async () => {
    const { fx, sold } = await setup()
    const order = await sold(3)
    await closeCashSession(fx.staffA, {
      warehouseId: fx.a.id,
      countedCents: 3000,
    })
    const before = await orderState()
    const error = await errorOf(() => reopenSale(fx.owner, order.id))
    expect(error).toMatchObject({ code: 'conflict', message: drawerMessage })
    expect(await orderState()).toEqual(before)
  })

  test('never touches a closed cash cut: the outflow lands in the new drawer', async () => {
    const { fx, sold } = await setup()
    const order = await sold(3)
    const closed = await closeCashSession(fx.staffA, {
      warehouseId: fx.a.id,
      countedCents: 3000,
    })
    const opened = await openCashSession(fx.staffA, {
      warehouseId: fx.a.id,
      openingCents: 3000,
    })
    await reopenSale(fx.owner, order.id)
    const rows = await db.select().from(cashMovements)
    expect(rows.find((m) => m.type === 'withdrawal')?.sessionId).toBe(opened.id)
    expect(rows.find((m) => m.type === 'sale')?.sessionId).toBe(closed.id)
  })

  test('only a Recogido order can be reopened, and a second call fails cleanly', async () => {
    const { fx, sold } = await setup()
    const reserved = await createOrder(fx.staffA, {
      warehouseId: fx.a.id,
      customerId: fx.customer.id,
      lines: [{ presentationId: fx.pieceId, quantity: 2 }],
    })
    const refusal = 'Solo se puede reabrir una venta ya entregada.'
    expect(
      await errorOf(() => reopenSale(fx.owner, reserved.id)),
    ).toMatchObject({ code: 'conflict', message: refusal })
    const order = await sold(3)
    await reopenSale(fx.owner, order.id)
    const before = await orderState()
    expect(await errorOf(() => reopenSale(fx.owner, order.id))).toMatchObject({
      code: 'conflict',
      message: refusal,
    })
    expect(await orderState()).toEqual(before)
    expect(await db.select().from(cashMovements)).toHaveLength(2)
  })

  test('the reservation window restarts, so expiry does not release it at once', async () => {
    const { fx, sold } = await setup()
    const order = await sold(3)
    advance(72)
    await reopenSale(fx.owner, order.id)
    await db.transaction((tx) => expireOverdueOrders(tx, fx.a.id))
    const row = (
      await db.select().from(orders).where(eq(orders.id, order.id))
    )[0]
    expect(row.status).toBe('Reservado')
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 71 * 3_600_000)
  })

  test('reopen → edit → deliver again: stock, cash and reports are consistent', async () => {
    const { fx, sold, lotRows } = await setup()
    const order = await sold(4)
    const reportBefore = await getSalesReport(fx.owner, wide)
    expect(reportBefore.summary.units).toBe(4)
    await reopenSale(fx.owner, order.id)
    const reportMid = await getSalesReport(fx.owner, wide)
    expect(reportMid.summary.units).toBe(0)
    expect(reportMid.summary.revenueCents).toBe(0)

    await editReservedOrder(fx.owner, {
      orderId: order.id,
      changes: [{ presentationId: fx.pieceId, quantity: 7 }],
      add: [],
    })
    const delivered = await pickupOrder(fx.owner, order.id, payCash)
    expect(delivered.status).toBe('Recogido')
    expect(delivered.totalCents).toBe(7000)

    const after = await lotRows()
    expect(after.reduce((n, l) => n + l.onHand, 0)).toBe(9)
    expect(after.every((l) => l.reserved === 0)).toBe(true)
    const session = await drawer(fx)
    expect(session.movements.reduce((n, m) => n + m.amountCents, 0)).toBe(7000)
    const report = await getSalesReport(fx.owner, wide)
    expect(report.summary.units).toBe(7)
    expect(report.summary.revenueCents).toBe(7000)

    // and it can be reopened again (second cycle)
    await reopenSale(fx.owner, order.id)
    const rows = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.orderId, order.id))
    expect(rows.reduce((n, m) => n + m.amountCents, 0)).toBe(0)
    expect(
      (await db.select().from(orders).where(eq(orders.id, order.id)))[0]
        .reopenCount,
    ).toBe(2)
  })
})

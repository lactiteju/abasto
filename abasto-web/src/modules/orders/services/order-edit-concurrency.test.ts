import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { lots } from '#/modules/inventory/db/schema'
import {
  orderAllocations,
  orderLines,
  orders,
} from '#/modules/orders/db/schema'
import {
  cancelOrder,
  pickupOrder,
} from '#/modules/orders/services/order-actions'
import { editReservedOrder } from '#/modules/orders/services/order-edit'
import { lockWarehouseStock } from '#/modules/orders/services/expiry'
import { createOrder } from '#/modules/orders/services/orders'
import {
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
const edit = (
  fx: Fx,
  orderId: string,
  changes: Array<ReturnType<typeof line>>,
  add: Array<ReturnType<typeof line>> = [],
) => editReservedOrder(fx.staffA, { orderId, changes, add })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits until `count` database sessions are blocked on a lock. */
async function waitForBlocked(count: number) {
  for (let i = 0; i < 400; i++) {
    const { rows } = await db.execute<{ blocked: number }>(
      sql`select count(*)::int as blocked from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'`,
    )
    if (rows[0].blocked >= count) return
    await sleep(10)
  }
  throw new Error('The operations never blocked.')
}

/**
 * Holds the warehouse stock lock, starts `ops` one after another (each waits
 * behind the lock, so they queue in that order), then lets them all go.
 */
async function forced(fx: Fx, ops: Array<() => Promise<unknown>>) {
  let release = () => {}
  let held = () => {}
  const holding = new Promise<void>((resolve) => (held = resolve))
  const helper = db.transaction(async (tx) => {
    await lockWarehouseStock(tx, fx.a.id)
    held()
    await new Promise<void>((resolve) => (release = resolve))
  })
  await holding
  const runs: Array<Promise<PromiseSettledResult<unknown>>> = []
  for (const [i, op] of ops.entries()) {
    runs.push(
      op().then(
        (value) => ({ status: 'fulfilled', value }) as const,
        (reason) => ({ status: 'rejected', reason }) as const,
      ),
    )
    await waitForBlocked(i + 1)
  }
  release()
  await helper
  return Promise.all(runs)
}

/** Every lot: reserved == units of Reservado allocations, 0 <= reserved <= onHand. */
async function expectConsistent() {
  const rows = await db
    .select({
      id: lots.id,
      onHand: lots.onHand,
      reserved: lots.reserved,
      held: sql<number>`coalesce(sum(${orderAllocations.quantity}) filter (where ${orders.status} = 'Reservado'), 0)::int`,
    })
    .from(lots)
    .leftJoin(orderAllocations, eq(orderAllocations.lotId, lots.id))
    .leftJoin(orderLines, eq(orderLines.id, orderAllocations.orderLineId))
    .leftJoin(orders, eq(orders.id, orderLines.orderId))
    .groupBy(lots.id)
    .orderBy(asc(lots.id))
  for (const row of rows) {
    expect(row.reserved).toBe(row.held)
    expect(row.reserved).toBeGreaterThanOrEqual(0)
    expect(row.reserved).toBeLessThanOrEqual(row.onHand)
  }
  // Order totals equal their line totals.
  const totals = await db
    .select({
      total: orders.totalCents,
      sum: sql<number>`coalesce(sum(${orderLines.lineTotalCents}), 0)::int`,
    })
    .from(orders)
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .groupBy(orders.id)
  for (const t of totals) expect(t.total).toBe(t.sum)
  return rows
}

const deadlocks = (results: Array<PromiseSettledResult<unknown>>) =>
  results.filter(
    (r) =>
      r.status === 'rejected' &&
      (r.reason as { cause?: { code?: string } }).cause?.code === '40P01',
  )
const messageOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as Error).message : 'ok'

describe('editReservedOrder under forced races', () => {
  test('edit-lower then create: the create can use the freed units', async () => {
    const fx = await setupOrders()
    const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
    const order = await place(fx, [line(fx.pieceId, 8)])
    const results = await forced(fx, [
      () => edit(fx, order.id, [line(fx.pieceId, 3)]),
      () => place(fx, [line(fx.pieceId, 7)]),
    ])
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const rows = await expectConsistent()
    expect(rows.find((r) => r.id === lot.id)?.reserved).toBe(10)
  })

  test('create then edit-lower: the create is refused, the edit still frees', async () => {
    const fx = await setupOrders()
    const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
    const order = await place(fx, [line(fx.pieceId, 8)])
    const results = await forced(fx, [
      () => place(fx, [line(fx.pieceId, 7)]),
      () => edit(fx, order.id, [line(fx.pieceId, 3)]),
    ])
    expect(results.map(messageOf)).toEqual([
      'No hay suficiente existencia disponible de Leche entera 1L.',
      'ok',
    ])
    const rows = await expectConsistent()
    expect(rows.find((r) => r.id === lot.id)?.reserved).toBe(3)
  })

  test('edit-lower vs pickup of the same order, both orders of arrival', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const fx = await setupOrders()
      const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
      const order = await place(fx, [line(fx.pieceId, 8)])
      const doEdit = () => edit(fx, order.id, [line(fx.pieceId, 3)])
      const doPickup = () => pickupOrder(fx.staffA, order.id, payCash)
      const results = await forced(
        fx,
        editFirst ? [doEdit, doPickup] : [doPickup, doEdit],
      )
      expect(deadlocks(results)).toEqual([])
      const rows = await expectConsistent()
      const row = rows.find((r) => r.id === lot.id)!
      if (editFirst) {
        expect(results.map(messageOf)).toEqual(['ok', 'ok'])
        expect(row).toMatchObject({ onHand: 7, reserved: 0 })
      } else {
        expect(results.map(messageOf)).toEqual([
          'ok',
          'Solo se puede editar un pedido reservado.',
        ])
        expect(row).toMatchObject({ onHand: 2, reserved: 0 })
      }
    }
  }, 30_000)

  test('edit-lower vs cancel of the same order, both orders of arrival', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const fx = await setupOrders()
      const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
      const order = await place(fx, [line(fx.pieceId, 8)])
      const doEdit = () => edit(fx, order.id, [line(fx.pieceId, 3)])
      const doCancel = () => cancelOrder(fx.staffA, order.id)
      const results = await forced(
        fx,
        editFirst ? [doEdit, doCancel] : [doCancel, doEdit],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(
        editFirst
          ? ['ok', 'ok']
          : ['ok', 'Solo se puede editar un pedido reservado.'],
      )
      const rows = await expectConsistent()
      expect(rows.find((r) => r.id === lot.id)).toMatchObject({
        onHand: 10,
        reserved: 0,
      })
    }
  }, 30_000)

  test('two edits of the same order: the second sees the first (no double release)', async () => {
    const fx = await setupOrders()
    const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
    const order = await place(fx, [line(fx.pieceId, 8)])
    const results = await forced(fx, [
      () => edit(fx, order.id, [line(fx.pieceId, 3)]),
      () => edit(fx, order.id, [line(fx.pieceId, 1)]),
    ])
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const rows = await expectConsistent()
    expect(rows.find((r) => r.id === lot.id)?.reserved).toBe(1)
  })

  test('edit-lower of one order frees units a concurrent edit-raise of another takes', async () => {
    const fx = await setupOrders()
    const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
    const a = await place(fx, [line(fx.pieceId, 6)])
    const b = await place(fx, [line(fx.pieceId, 4)])
    for (const lowerFirst of [true, false]) {
      const lower = () => edit(fx, a.id, [line(fx.pieceId, 2)])
      const raise = () => edit(fx, b.id, [line(fx.pieceId, 8)])
      const results = await forced(
        fx,
        lowerFirst ? [lower, raise] : [raise, lower],
      )
      expect(deadlocks(results)).toEqual([])
      const rows = await expectConsistent()
      const reserved = rows.find((r) => r.id === lot.id)!.reserved
      if (lowerFirst) {
        expect(results.map(messageOf)).toEqual(['ok', 'ok'])
        expect(reserved).toBe(10)
        // put things back: b to 4, a to 6
        await edit(fx, b.id, [line(fx.pieceId, 4)])
        await edit(fx, a.id, [line(fx.pieceId, 6)])
        await expectConsistent()
      } else {
        expect(results.map(messageOf)).toEqual([
          'No hay suficiente existencia disponible de Leche entera 1L.',
          'ok',
        ])
        expect(reserved).toBe(6)
      }
    }
  }, 30_000)

  test('remove + add across two lots crossing a concurrent edit the other way', async () => {
    const fx = await setupOrders()
    const milk = await receive(fx, { productId: fx.milkBox.id, quantity: 10 })
    const cola = await receive(fx, { productId: fx.cola.id, quantity: 10 })
    const colaPiece = fx.piece(fx.cola).id
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: colaPiece, priceCents: 700 }],
    })
    const a = await place(fx, [line(fx.pieceId, 5), line(colaPiece, 1)])
    const b = await place(fx, [line(colaPiece, 5), line(fx.pieceId, 1)])
    const results = await forced(fx, [
      () => edit(fx, a.id, [line(fx.pieceId, 0)], []), // frees milk
      () => edit(fx, b.id, [line(colaPiece, 0), line(fx.pieceId, 9)]), // frees cola, takes milk
      () => place(fx, [line(colaPiece, 9)]), // takes cola freed by b
    ])
    expect(deadlocks(results)).toEqual([])
    expect(results.map(messageOf)).toEqual(['ok', 'ok', 'ok'])
    const rows = await expectConsistent()
    expect(rows.find((r) => r.id === milk.id)?.reserved).toBe(9)
    expect(rows.find((r) => r.id === cola.id)?.reserved).toBe(10)
  })
})

describe('editReservedOrder under unforced contention', () => {
  test('a burst of edits, creates, cancels and pickups keeps every lot consistent', async () => {
    const fx = await setupOrders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 24 })
    await receive(fx, {
      productId: fx.milkBox.id,
      quantity: 24,
      expiresOn: '2099-01-01',
    })
    const placed = []
    for (let i = 0; i < 6; i++) placed.push(await place(fx, [line(fx.pieceId, 6)]))
    const ops: Array<Promise<unknown>> = [
      edit(fx, placed[0].id, [line(fx.pieceId, 1)]),
      edit(fx, placed[1].id, [line(fx.pieceId, 12)]),
      edit(fx, placed[2].id, [line(fx.pieceId, 2)], [line(fx.boxId, 1)]),
      edit(fx, placed[0].id, [line(fx.pieceId, 9)]),
      cancelOrder(fx.staffA, placed[3].id),
      edit(fx, placed[3].id, [line(fx.pieceId, 2)]),
      pickupOrder(fx.staffA, placed[4].id, payCash),
      edit(fx, placed[4].id, [line(fx.pieceId, 3)]),
      edit(fx, placed[5].id, [line(fx.pieceId, 0)], [line(fx.boxId, 1)]),
      place(fx, [line(fx.pieceId, 10)]),
      place(fx, [line(fx.boxId, 1)]),
    ]
    const results = await Promise.allSettled(ops)
    expect(deadlocks(results)).toEqual([])
    for (const r of results) {
      if (r.status === 'rejected') {
        expect((r.reason as { code?: string }).code).toBe('conflict')
      }
    }
    await expectConsistent()
  }, 30_000)
})

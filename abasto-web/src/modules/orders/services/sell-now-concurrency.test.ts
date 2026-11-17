import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { cashMovements, cashSessions } from '#/modules/cash/db/schema'
import { lockOpenSession } from '#/modules/cash/services/cash-ledger'
import { closeCashSession } from '#/modules/cash/services/cash-sessions'
import { lots } from '#/modules/inventory/db/schema'
import { registerLoss } from '#/modules/inventory/services/stock-adjustments'
import {
  orderAllocations,
  orderLines,
  orders,
} from '#/modules/orders/db/schema'
import {
  cancelOrder,
  pickupOrder,
} from '#/modules/orders/services/order-actions'
import { lockWarehouseStock } from '#/modules/orders/services/expiry'
import { editReservedOrder } from '#/modules/orders/services/order-edit'
import { createOrder } from '#/modules/orders/services/orders'
import { sellNow } from '#/modules/orders/services/sell-now'
import {
  advance,
  payCash,
  receive,
  useClock,
} from '#/modules/orders/services/testing'
import { assignRider } from '#/modules/riders/services/assignments'
import { setupRiders } from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

type Fx = Awaited<ReturnType<typeof setupRiders>>
const line = (presentationId: string, quantity: number) => ({
  presentationId,
  quantity,
})
const reserve = (fx: Fx, pieces: number) =>
  createOrder(fx.staffA, {
    warehouseId: fx.a.id,
    customerId: fx.customer.id,
    lines: [line(fx.pieceId, pieces)],
  })
const sell = (fx: Fx, pieces: number) =>
  sellNow(
    fx.staffA,
    {
      warehouseId: fx.a.id,
      customerId: fx.customer.id,
      lines: [line(fx.pieceId, pieces)],
    },
    payCash,
  )

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
 * Holds a lock (taken by `hold`), starts `ops` one after another (each waits
 * behind the lock, so they queue in that order), then lets them all go.
 */
async function forcedBehind(
  hold: Parameters<typeof db.transaction>[0],
  ops: Array<() => Promise<unknown>>,
) {
  let release = () => {}
  let held = () => {}
  const holding = new Promise<void>((resolve) => (held = resolve))
  const helper = db.transaction(async (tx) => {
    await hold(tx)
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

/** Queues operations behind the warehouse stock lock, in the given order. */
const forced = (fx: Fx, ops: Array<() => Promise<unknown>>) =>
  forcedBehind((tx) => lockWarehouseStock(tx, fx.a.id), ops)

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

/** Every delivered order has exactly one cash sale of its total. */
async function expectCashMatchesSales() {
  const sold = await db
    .select({ id: orders.id, total: orders.totalCents })
    .from(orders)
    .where(eq(orders.status, 'Recogido'))
  const sales = await db.select().from(cashMovements)
  expect(sales.map((s) => s.orderId).sort()).toEqual(
    sold.map((o) => o.id).sort(),
  )
  for (const sale of sales) {
    expect(sale.amountCents).toBe(
      sold.find((o) => o.id === sale.orderId)!.total,
    )
  }
}

const deadlocks = (results: Array<PromiseSettledResult<unknown>>) =>
  results.filter(
    (r) =>
      r.status === 'rejected' &&
      (r.reason as { cause?: { code?: string } }).cause?.code === '40P01',
  )
const messageOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as Error).message : 'ok'
const short = 'No hay suficiente existencia disponible de Leche entera 1L.'

async function setup(quantity = 10) {
  const fx = await setupRiders()
  const lot = await receive(fx, { productId: fx.milkBox.id, quantity })
  return { fx, lot }
}
const lotOf = async (id: string) =>
  (await db.select().from(lots).where(eq(lots.id, id)))[0]

describe('sellNow under forced races', () => {
  test('sell vs reserve on the same lot, both orders of arrival', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const doSell = () => sell(fx, 7)
      const doReserve = () => reserve(fx, 7)
      const results = await forced(
        fx,
        sellFirst ? [doSell, doReserve] : [doReserve, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(['ok', short])
      await expectConsistent()
      await expectCashMatchesSales()
      expect(await lotOf(lot.id)).toMatchObject(
        sellFirst ? { onHand: 3, reserved: 0 } : { onHand: 10, reserved: 7 },
      )
    }
  }, 30_000)

  test('two sells for the last units: one wins, the other leaves nothing behind', async () => {
    const { fx, lot } = await setup()
    const results = await forced(fx, [() => sell(fx, 7), () => sell(fx, 7)])
    expect(deadlocks(results)).toEqual([])
    expect(results.map(messageOf)).toEqual(['ok', short])
    expect(await lotOf(lot.id)).toMatchObject({ onHand: 3, reserved: 0 })
    expect(await db.select().from(orders)).toHaveLength(1)
    await expectConsistent()
    await expectCashMatchesSales()
  })

  test('two sells that both fit are both delivered', async () => {
    const { fx, lot } = await setup()
    const results = await forced(fx, [() => sell(fx, 4), () => sell(fx, 6)])
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    expect(await lotOf(lot.id)).toMatchObject({ onHand: 0, reserved: 0 })
    await expectConsistent()
    await expectCashMatchesSales()
  })

  test('sell vs rider assign on the same lot, both orders of arrival', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const doSell = () => sell(fx, 7)
      const doAssign = () =>
        assignRider(fx.staffA, {
          riderId: fx.rider.id,
          lines: [{ productId: fx.milkBox.id, boxes: 0, units: 7 }],
        })
      const results = await forced(
        fx,
        sellFirst ? [doSell, doAssign] : [doAssign, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      expect(messageOf(results[0])).toBe('ok')
      const failed = results.filter((r) => r.status === 'rejected')
      expect(failed).toHaveLength(1)
      const row = await lotOf(lot.id)
      if (sellFirst) {
        expect(messageOf(results[1])).not.toBe('ok')
        expect(row).toMatchObject({ onHand: 3, reserved: 0 })
        expect(await db.select().from(cashMovements)).toHaveLength(1)
      } else {
        expect(messageOf(results[1])).toBe(short)
        expect(row).toMatchObject({ onHand: 10, reserved: 7 })
        expect(await db.select().from(orders)).toHaveLength(0)
        expect(await db.select().from(cashMovements)).toHaveLength(0)
      }
    }
  }, 30_000)

  test('sell after a cancel frees units uses them; before it, it is refused', async () => {
    for (const cancelFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const held = await reserve(fx, 8)
      const doCancel = () => cancelOrder(fx.staffA, held.id)
      const doSell = () => sell(fx, 7)
      const results = await forced(
        fx,
        cancelFirst ? [doCancel, doSell] : [doSell, doCancel],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(
        cancelFirst ? ['ok', 'ok'] : [short, 'ok'],
      )
      expect(await lotOf(lot.id)).toMatchObject(
        cancelFirst ? { onHand: 3, reserved: 0 } : { onHand: 10, reserved: 0 },
      )
      await expectConsistent()
      await expectCashMatchesSales()
    }
  }, 30_000)

  test('sell vs pickup of a reserved order: both deliver, no double count', async () => {
    const { fx, lot } = await setup()
    const held = await reserve(fx, 5)
    const results = await forced(fx, [
      () => sell(fx, 5),
      () => pickupOrder(fx.staffA, held.id, payCash),
    ])
    expect(deadlocks(results)).toEqual([])
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    expect(await lotOf(lot.id)).toMatchObject({ onHand: 0, reserved: 0 })
    await expectConsistent()
    await expectCashMatchesSales()
  })

  test('sell vs closing the drawer: a sale queued first is counted, one queued after is refused whole', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const doSell = () => sell(fx, 3)
      const doClose = () =>
        closeCashSession(fx.staffA, { warehouseId: fx.a.id, countedCents: 0 })
      const results = await forcedBehind(
        async (tx) => {
          await lockOpenSession(tx, fx.a.id)
        },
        sellFirst ? [doSell, doClose] : [doClose, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      const [session] = await db.select().from(cashSessions)
      expect(session.status).toBe('closed')
      if (sellFirst) {
        expect(results.map(messageOf)).toEqual(['ok', 'ok'])
        expect(session.expectedCents).toBe(3000)
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 7, reserved: 0 })
        await expectCashMatchesSales()
      } else {
        expect(results.map(messageOf)).toEqual([
          'ok',
          'Abre la caja antes de cobrar.',
        ])
        expect(session.expectedCents).toBe(0)
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 10, reserved: 0 })
        expect(await db.select().from(orders)).toHaveLength(0)
        expect(await db.select().from(cashMovements)).toHaveLength(0)
      }
    }
  }, 30_000)
})

describe('sellNow under forced races (verifier additions)', () => {
  test('sell vs raising a reserved order on the same lot, both orders of arrival', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const held = await reserve(fx, 2)
      const doSell = () => sell(fx, 5)
      const doEdit = () =>
        editReservedOrder(fx.staffA, {
          orderId: held.id,
          changes: [{ presentationId: fx.pieceId, quantity: 8 }],
          add: [],
        })
      const results = await forced(
        fx,
        sellFirst ? [doSell, doEdit] : [doEdit, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      expect(messageOf(results[0])).toBe('ok')
      expect(results[1].status).toBe('rejected')
      if (sellFirst) {
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 5, reserved: 2 })
        expect(await db.select().from(cashMovements)).toHaveLength(1)
      } else {
        expect(messageOf(results[1])).toBe(short)
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 10, reserved: 8 })
        expect(await db.select().from(orders)).toHaveLength(1)
        expect(await db.select().from(cashMovements)).toHaveLength(0)
      }
      await expectConsistent()
      await expectCashMatchesSales()
    }
  }, 30_000)

  test('sell vs pickup of an overdue reservation: the units go to the sale either way', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const held = await reserve(fx, 8)
      advance(25)
      const doSell = () => sell(fx, 7)
      const doPickup = () => pickupOrder(fx.staffA, held.id, payCash)
      const results = await forced(
        fx,
        sellFirst ? [doSell, doPickup] : [doPickup, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      const expired =
        'El pedido venció y se liberó el producto. Crea un pedido nuevo.'
      expect(results.map(messageOf)).toEqual(
        sellFirst ? ['ok', expired] : [expired, 'ok'],
      )
      const [stale] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, held.id))
      expect(stale.status).toBe('Vencido')
      expect(await lotOf(lot.id)).toMatchObject({ onHand: 3, reserved: 0 })
      expect(await db.select().from(cashMovements)).toHaveLength(1)
      await expectConsistent()
      await expectCashMatchesSales()
      useClock(null)
    }
  }, 30_000)

  test('sell vs a loss on the same lot, both orders of arrival', async () => {
    for (const sellFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lot } = await setup()
      const doSell = () => sell(fx, 7)
      const doLoss = () =>
        registerLoss(fx.owner, {
          lotId: lot.id,
          quantity: 5,
          category: 'dañado',
          reason: 'golpe',
        })
      const results = await forced(
        fx,
        sellFirst ? [doSell, doLoss] : [doLoss, doSell],
      )
      expect(deadlocks(results)).toEqual([])
      expect(messageOf(results[0])).toBe('ok')
      expect(results[1].status).toBe('rejected')
      if (sellFirst) {
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 3, reserved: 0 })
        expect(await db.select().from(cashMovements)).toHaveLength(1)
      } else {
        expect(messageOf(results[1])).toBe(short)
        expect(await lotOf(lot.id)).toMatchObject({ onHand: 5, reserved: 0 })
        expect(await db.select().from(orders)).toHaveLength(0)
        expect(await db.select().from(cashMovements)).toHaveLength(0)
      }
      await expectConsistent()
      await expectCashMatchesSales()
    }
  }, 30_000)
})

describe('sellNow under unforced contention', () => {
  test('a burst of sells, reserves, cancels and pickups keeps every lot consistent', async () => {
    const { fx } = await setup(30)
    await receive(fx, {
      productId: fx.milkBox.id,
      quantity: 30,
      expiresOn: '2099-01-01',
    })
    const placed = []
    for (let i = 0; i < 4; i++) placed.push(await reserve(fx, 5))
    const ops: Array<Promise<unknown>> = [
      sell(fx, 10),
      sell(fx, 12),
      sell(fx, 25),
      sell(fx, 8),
      reserve(fx, 9),
      cancelOrder(fx.staffA, placed[0].id),
      pickupOrder(fx.staffA, placed[1].id, payCash),
      cancelOrder(fx.staffA, placed[2].id),
      sell(fx, 7),
    ]
    const results = await Promise.allSettled(ops)
    expect(deadlocks(results)).toEqual([])
    for (const r of results) {
      if (r.status === 'rejected') {
        expect((r.reason as { code?: string }).code).toBe('conflict')
      }
    }
    await expectConsistent()
    await expectCashMatchesSales()
  }, 30_000)
})

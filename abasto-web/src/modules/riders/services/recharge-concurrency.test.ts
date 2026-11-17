/**
 * Forced races around «Recargar»: every operation queues behind the
 * warehouse stock lock in a known order, then all are released together.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import {
  orderAllocations,
  orderLines,
  orders,
} from '#/modules/orders/db/schema'
import { lockWarehouseStock } from '#/modules/orders/services/expiry'
import { createOrder } from '#/modules/orders/services/orders'
import { setPrices } from '#/modules/pricing/services/prices'
import {
  riderAllocations,
  riderAssignmentLines,
  riderAssignments,
} from '#/modules/riders/db/schema'
import {
  assignRider,
  cancelAssignment,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import { rechargeAssignment } from '#/modules/riders/services/recharge'
import { receive, setupRiders } from '#/modules/riders/services/testing'
import type { RidersFixture } from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function forced(
  fx: RidersFixture,
  ops: Array<() => Promise<unknown>>,
): Promise<Array<PromiseSettledResult<unknown>>> {
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

const messageOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as Error).message : 'ok'
const deadlocks = (results: Array<PromiseSettledResult<unknown>>) =>
  results.filter(
    (r) =>
      r.status === 'rejected' &&
      (r.reason as { cause?: { code?: string } }).cause?.code === '40P01',
  )

/**
 * Every lot: reserved == Reservado order allocations + allocations of
 * «En ruta» assignments, 0 <= reserved <= onHand; every rider line's
 * assigned quantity equals its allocations; settled allocations split exactly.
 */
async function expectConsistent() {
  const orderHeld = await db
    .select({
      lotId: orderAllocations.lotId,
      held: sql<number>`coalesce(sum(${orderAllocations.quantity}) filter (where ${orders.status} = 'Reservado'), 0)::int`,
    })
    .from(orderAllocations)
    .innerJoin(orderLines, eq(orderLines.id, orderAllocations.orderLineId))
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .groupBy(orderAllocations.lotId)
  const riderHeld = await db
    .select({
      lotId: riderAllocations.lotId,
      held: sql<number>`coalesce(sum(${riderAllocations.quantity}) filter (where ${riderAssignments.status} = 'En ruta'), 0)::int`,
    })
    .from(riderAllocations)
    .innerJoin(
      riderAssignmentLines,
      eq(riderAssignmentLines.id, riderAllocations.lineId),
    )
    .innerJoin(
      riderAssignments,
      eq(riderAssignments.id, riderAssignmentLines.assignmentId),
    )
    .groupBy(riderAllocations.lotId)
  const rows = await db.select().from(lots).orderBy(asc(lots.id))
  for (const row of rows) {
    const held =
      (orderHeld.find((h) => h.lotId === row.id)?.held ?? 0) +
      (riderHeld.find((h) => h.lotId === row.id)?.held ?? 0)
    expect(row.reserved).toBe(held)
    expect(row.reserved).toBeGreaterThanOrEqual(0)
    expect(row.reserved).toBeLessThanOrEqual(row.onHand)
  }
  const lines = await db
    .select({
      assigned: riderAssignmentLines.assignedQuantity,
      sum: sql<number>`coalesce(sum(${riderAllocations.quantity}), 0)::int`,
    })
    .from(riderAssignmentLines)
    .leftJoin(
      riderAllocations,
      eq(riderAllocations.lineId, riderAssignmentLines.id),
    )
    .groupBy(riderAssignmentLines.id)
  for (const line of lines) expect(line.assigned).toBe(line.sum)
  // Ledger: onHand equals the sum of the lot's movements.
  const ledger = await db
    .select({
      lotId: stockMovements.lotId,
      sum: sql<number>`sum(${stockMovements.quantity})::int`,
    })
    .from(stockMovements)
    .groupBy(stockMovements.lotId)
  for (const row of rows) {
    expect(ledger.find((l) => l.lotId === row.id)?.sum ?? 0).toBe(row.onHand)
  }
  return rows
}

/** One lot of 100 milk (box of 12), Luis on the road with 50. */
async function setup() {
  const fx = await setupRiders()
  const lot = await receive(fx, { productId: fx.milkBox.id, quantity: 100 })
  const assigned = await assignRider(fx.staffA, {
    riderId: fx.rider.id,
    lines: [{ productId: fx.milkBox.id, boxes: 0, units: 50 }],
  })
  const recharge = (units: number) => () =>
    rechargeAssignment(fx.staffA, {
      assignmentId: assigned.id,
      lines: [{ productId: fx.milkBox.id, boxes: 0, units }],
    })
  const lotRow = async () =>
    (await db.select().from(lots).where(eq(lots.id, lot.id)))[0]
  const assignment = async () =>
    (
      await db
        .select()
        .from(riderAssignments)
        .where(eq(riderAssignments.id, assigned.id))
    )[0]
  return { fx, lot, assigned, recharge, lotRow, assignment }
}

describe('rechargeAssignment under forced races', () => {
  test('recarga vs settle, both orders of arrival', async () => {
    for (const rechargeFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, assigned, recharge, lotRow, assignment } = await setup()
      // All 50 (or 70) came back: nothing sold.
      const settle = () =>
        settleAssignment(fx.staffA, {
          assignmentId: assigned.id,
          deliveredCents: 0,
          lines: [{ lineId: assigned.lines[0].id, boxes: 0, units: 10 }],
        })
      const results = await forced(
        fx,
        rechargeFirst ? [recharge(20), settle] : [settle, recharge(20)],
      )
      expect(deadlocks(results)).toEqual([])
      await expectConsistent()
      const row = await lotRow()
      const head = await assignment()
      expect(head.status).toBe('Liquidada')
      if (rechargeFirst) {
        expect(results.map(messageOf)).toEqual(['ok', 'ok'])
        // 70 assigned, 10 back: 60 sold at 1000.
        expect(head.expectedCents).toBe(60 * 1000)
        expect(row).toMatchObject({ onHand: 40, reserved: 0 })
      } else {
        expect(results.map(messageOf)).toEqual([
          'ok',
          'Este reparto ya no está en ruta.',
        ])
        expect(head.expectedCents).toBe(40 * 1000)
        expect(row).toMatchObject({ onHand: 60, reserved: 0 })
      }
    }
  }, 30_000)

  test('recarga adding a new product vs a settle prepared before it', async () => {
    const { fx, assigned, lotRow, assignment } = await setup()
    await receive(fx, { productId: fx.cola.id, quantity: 50 })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    const results = await forced(fx, [
      () =>
        rechargeAssignment(fx.staffA, {
          assignmentId: assigned.id,
          lines: [{ productId: fx.cola.id, boxes: 0, units: 5 }],
        }),
      () =>
        settleAssignment(fx.staffA, {
          assignmentId: assigned.id,
          deliveredCents: 0,
          lines: [{ lineId: assigned.lines[0].id, boxes: 0, units: 50 }],
        }),
    ])
    expect(deadlocks(results)).toEqual([])
    // The stale settle misses the new line: refused, the recarga stands.
    expect(results.map(messageOf)).toEqual([
      'ok',
      'Indica lo que regresó de cada producto del reparto.',
    ])
    expect((await assignment()).status).toBe('En ruta')
    await expectConsistent()
    expect(await lotRow()).toMatchObject({ onHand: 100, reserved: 50 })
  })

  test('recarga vs cancel, both orders of arrival', async () => {
    for (const rechargeFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, assigned, recharge, lotRow, assignment } = await setup()
      const cancel = () =>
        cancelAssignment(fx.staffA, { assignmentId: assigned.id })
      const results = await forced(
        fx,
        rechargeFirst ? [recharge(30), cancel] : [cancel, recharge(30)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(
        rechargeFirst
          ? ['ok', 'ok']
          : ['ok', 'Este reparto ya no está en ruta.'],
      )
      expect((await assignment()).status).toBe('Cancelada')
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ onHand: 100, reserved: 0 })
    }
  }, 30_000)

  test('recarga vs assignRider of another rider on the same lot', async () => {
    for (const rechargeFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, recharge, lotRow } = await setup()
      // 50 free: each wants 40, only the first fits.
      const assignOther = () =>
        assignRider(fx.staffA, {
          riderId: fx.other.id,
          lines: [{ productId: fx.milkBox.id, boxes: 0, units: 40 }],
        })
      const results = await forced(
        fx,
        rechargeFirst
          ? [recharge(40), assignOther]
          : [assignOther, recharge(40)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ onHand: 100, reserved: 90 })
      const open = await db
        .select()
        .from(riderAssignments)
        .where(eq(riderAssignments.status, 'En ruta'))
      expect(open).toHaveLength(rechargeFirst ? 1 : 2)
    }
  }, 30_000)

  test('recarga vs a counter order on the same lot', async () => {
    for (const rechargeFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, recharge, lotRow } = await setup()
      const order = () =>
        createOrder(fx.staffA, {
          warehouseId: fx.a.id,
          customerId: fx.customer.id,
          lines: [{ presentationId: fx.pieceId, quantity: 40 }],
        })
      const results = await forced(
        fx,
        rechargeFirst ? [recharge(40), order] : [order, recharge(40)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ onHand: 100, reserved: 90 })
    }
  }, 30_000)

  test('two recargas: both fit, then only one fits', async () => {
    {
      const { fx, recharge, lotRow, assigned } = await setup()
      const results = await forced(fx, [recharge(20), recharge(25)])
      expect(results.map(messageOf)).toEqual(['ok', 'ok'])
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ reserved: 95 })
      const [line] = await db
        .select()
        .from(riderAssignmentLines)
        .where(eq(riderAssignmentLines.assignmentId, assigned.id))
      expect(line.assignedQuantity).toBe(95)
      // Same lot, same prices: still one allocation row.
      expect(
        await db
          .select()
          .from(riderAllocations)
          .where(eq(riderAllocations.lineId, line.id)),
      ).toHaveLength(1)
    }
    await resetDatabase(db)
    {
      const { fx, recharge, lotRow } = await setup()
      const results = await forced(fx, [recharge(30), recharge(30)])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ reserved: 80 })
    }
  }, 30_000)

  test('unforced mix (recargas, order, other rider, settle) never deadlocks or oversells', async () => {
    for (let round = 0; round < 3; round++) {
      await resetDatabase(db)
      const { fx, assigned, recharge } = await setup()
      const results = await Promise.allSettled([
        recharge(15)(),
        recharge(15)(),
        createOrder(fx.staffA, {
          warehouseId: fx.a.id,
          customerId: fx.customer.id,
          lines: [{ presentationId: fx.pieceId, quantity: 15 }],
        }),
        assignRider(fx.staffA, {
          riderId: fx.other.id,
          lines: [{ productId: fx.milkBox.id, boxes: 0, units: 15 }],
        }),
        settleAssignment(fx.staffA, {
          assignmentId: assigned.id,
          deliveredCents: 0,
          lines: [{ lineId: assigned.lines[0].id, boxes: 0, units: 0 }],
        }),
      ])
      expect(deadlocks(results)).toEqual([])
      await expectConsistent()
    }
  }, 30_000)
})

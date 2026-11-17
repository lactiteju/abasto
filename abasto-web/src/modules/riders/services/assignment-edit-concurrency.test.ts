/**
 * Forced races around «Editar carga»: every operation queues behind the
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
import { editAssignmentLoad } from '#/modules/riders/services/assignment-edit'
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
  /** Lowers the line to `total` units. */
  const lower = (total: number) => () =>
    editAssignmentLoad(fx.staffA, {
      assignmentId: assigned.id,
      changes: [{ productId: fx.milkBox.id, boxes: 0, units: total }],
      add: [],
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
  return { fx, lot, assigned, lower, recharge, lotRow, assignment }
}

describe('editAssignmentLoad under forced races', () => {
  test('edit-lower vs assignRider of another rider on the same lot', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lower, lotRow } = await setup()
      // 50 free; the edit frees 30 more. The other rider wants 70.
      const assignOther = () =>
        assignRider(fx.staffA, {
          riderId: fx.other.id,
          lines: [{ productId: fx.milkBox.id, boxes: 0, units: 70 }],
        })
      const results = await forced(
        fx,
        editFirst ? [lower(20), assignOther] : [assignOther, lower(20)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map((r) => r.status)).toEqual(
        editFirst ? ['fulfilled', 'fulfilled'] : ['rejected', 'fulfilled'],
      )
      await expectConsistent()
      expect(await lotRow()).toMatchObject({
        onHand: 100,
        reserved: editFirst ? 90 : 20,
      })
    }
  }, 30_000)

  test('edit-lower vs a counter order on the same lot', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lower, lotRow } = await setup()
      const order = () =>
        createOrder(fx.staffA, {
          warehouseId: fx.a.id,
          customerId: fx.customer.id,
          lines: [{ presentationId: fx.pieceId, quantity: 70 }],
        })
      const results = await forced(
        fx,
        editFirst ? [lower(20), order] : [order, lower(20)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map((r) => r.status)).toEqual(
        editFirst ? ['fulfilled', 'fulfilled'] : ['rejected', 'fulfilled'],
      )
      await expectConsistent()
      expect(await lotRow()).toMatchObject({
        onHand: 100,
        reserved: editFirst ? 90 : 20,
      })
    }
  }, 30_000)

  test('edit-lower vs settle, both orders of arrival', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, assigned, lower, lotRow, assignment } = await setup()
      const settle = () =>
        settleAssignment(fx.staffA, {
          assignmentId: assigned.id,
          deliveredCents: 0,
          lines: [{ lineId: assigned.lines[0].id, boxes: 0, units: 10 }],
        })
      const results = await forced(
        fx,
        editFirst ? [lower(20), settle] : [settle, lower(20)],
      )
      expect(deadlocks(results)).toEqual([])
      await expectConsistent()
      const head = await assignment()
      expect(head.status).toBe('Liquidada')
      if (editFirst) {
        expect(results.map(messageOf)).toEqual(['ok', 'ok'])
        // 20 assigned, 10 back: 10 sold.
        expect(head.expectedCents).toBe(10 * 1000)
        expect(await lotRow()).toMatchObject({ onHand: 90, reserved: 0 })
      } else {
        expect(results.map(messageOf)).toEqual([
          'ok',
          'Este reparto ya no está en ruta.',
        ])
        expect(head.expectedCents).toBe(40 * 1000)
        expect(await lotRow()).toMatchObject({ onHand: 60, reserved: 0 })
      }
    }
  }, 30_000)

  test('edit-lower vs cancel, both orders of arrival', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, assigned, lower, lotRow, assignment } = await setup()
      const cancel = () =>
        cancelAssignment(fx.staffA, { assignmentId: assigned.id })
      const results = await forced(
        fx,
        editFirst ? [lower(20), cancel] : [cancel, lower(20)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(
        editFirst ? ['ok', 'ok'] : ['ok', 'Este reparto ya no está en ruta.'],
      )
      expect((await assignment()).status).toBe('Cancelada')
      await expectConsistent()
      expect(await lotRow()).toMatchObject({ onHand: 100, reserved: 0 })
    }
  }, 30_000)

  test('edit-lower vs recarga on the same line', async () => {
    for (const editFirst of [true, false]) {
      await resetDatabase(db)
      const { fx, lower, recharge, lotRow } = await setup()
      const results = await forced(
        fx,
        editFirst ? [lower(20), recharge(10)] : [recharge(10), lower(20)],
      )
      expect(deadlocks(results)).toEqual([])
      expect(results.map(messageOf)).toEqual(['ok', 'ok'])
      await expectConsistent()
      // 50 → 20 then +10 (30), or 50 → 60 then edit to a total of 20.
      expect(await lotRow()).toMatchObject({
        onHand: 100,
        reserved: editFirst ? 30 : 20,
      })
    }
  }, 30_000)

  test('two edits lowering the same line: the later total wins, nothing is released twice', async () => {
    const { fx, lower, lotRow, assigned } = await setup()
    const results = await forced(fx, [lower(30), lower(10)])
    expect(deadlocks(results)).toEqual([])
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    await expectConsistent()
    expect(await lotRow()).toMatchObject({ reserved: 10 })
    const [line] = await db
      .select()
      .from(riderAssignmentLines)
      .where(eq(riderAssignmentLines.assignmentId, assigned.id))
    expect(line.assignedQuantity).toBe(10)
  }, 30_000)

  test('unforced mix (edits, recarga, order, other rider, settle) never deadlocks or oversells', async () => {
    for (let round = 0; round < 3; round++) {
      await resetDatabase(db)
      const { fx, assigned, lower, recharge } = await setup()
      const results = await Promise.allSettled([
        lower(20)(),
        recharge(15)(),
        lower(35)(),
        createOrder(fx.staffA, {
          warehouseId: fx.a.id,
          customerId: fx.customer.id,
          lines: [{ presentationId: fx.pieceId, quantity: 30 }],
        }),
        assignRider(fx.staffA, {
          riderId: fx.other.id,
          lines: [{ productId: fx.milkBox.id, boxes: 0, units: 25 }],
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

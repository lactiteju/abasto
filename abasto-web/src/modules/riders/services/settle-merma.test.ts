import { beforeEach, describe, expect, test } from 'bun:test'
import { asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { cashMovements } from '#/modules/cash/db/schema'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { ledgerSum } from '#/modules/inventory/services/testing'
import { riderAllocations } from '#/modules/riders/db/schema'
import {
  assignRider,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import {
  errorOf,
  receive,
  riderState,
  setupRiders,
} from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

/** Two milk lots of 300 (oldest first); 500 pieces handed to Luis: 300 + 200. */
async function setup() {
  const fx = await setupRiders()
  const first = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const second = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const lotOf = async (id: string) =>
    (await db.select().from(lots).where(eq(lots.id, id)))[0]
  const detail = await assignRider(fx.staffA, {
    riderId: fx.rider.id,
    lines: [{ productId: fx.milkBox.id, boxes: 41, units: 8 }],
  })
  const settle = (
    leftover: { boxes: number; units: number },
    scrap: number,
    deliveredCents = 0,
  ) =>
    settleAssignment(fx.staffA, {
      assignmentId: detail.id,
      deliveredCents,
      lines: [{ lineId: detail.lines[0].id, ...leftover, scrap }],
    })
  return { fx, first, second, lotOf, detail, settle }
}

describe('settleAssignment with merma', () => {
  test('merma is neither sold nor returned: lots are not replenished, cash excludes it, a loss is recorded', async () => {
    const { fx, first, second, lotOf, detail, settle } = await setup()
    expect(detail.lines[0].assignedQuantity).toBe(500)
    // 30 back (2 boxes + 6), 20 damaged, 450 sold.
    const settled = await settle({ boxes: 2, units: 6 }, 20, 450_000)
    expect(settled).toMatchObject({
      status: 'Liquidada',
      expectedCents: 450_000,
      differenceCents: 0,
    })
    expect(settled.lines[0]).toMatchObject({
      leftoverQuantity: 30,
      scrapQuantity: 20,
      soldQuantity: 450,
    })
    // Sold oldest first; merma and leftover come from the newest allocation.
    expect(settled.lines[0].allocations).toMatchObject([
      {
        lotId: first.id,
        soldQuantity: 300,
        leftoverQuantity: 0,
        scrapQuantity: 0,
      },
      {
        lotId: second.id,
        soldQuantity: 150,
        leftoverQuantity: 30,
        scrapQuantity: 20,
      },
    ])
    expect(await lotOf(first.id)).toMatchObject({ onHand: 0, reserved: 0 })
    // 300 − 150 sold − 20 lost = 130, nothing held; merma is not available again.
    expect(await lotOf(second.id)).toMatchObject({ onHand: 130, reserved: 0 })
    const losses = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'loss'))
    expect(losses).toHaveLength(1)
    expect(losses[0]).toMatchObject({
      lotId: second.id,
      quantity: -20,
      reason: 'dañado: Reparto Luis',
      reference: detail.id,
      actorId: fx.staffA.userId,
    })
    expect(await ledgerSum(first.id)).toBe(0)
    expect(await ledgerSum(second.id)).toBe(130)
    const cash = await db.select().from(cashMovements)
    expect(cash).toHaveLength(1)
    expect(cash[0].amountCents).toBe(450_000)
  })

  test('merma spanning allocations is taken newest first and sold stays the oldest', async () => {
    const { first, second, lotOf, settle } = await setup()
    const settled = await settle({ boxes: 0, units: 0 }, 250, 250_000)
    expect(settled.expectedCents).toBe(250_000)
    expect(settled.lines[0].allocations).toMatchObject([
      {
        lotId: first.id,
        soldQuantity: 250,
        leftoverQuantity: 0,
        scrapQuantity: 50,
      },
      {
        lotId: second.id,
        soldQuantity: 0,
        leftoverQuantity: 0,
        scrapQuantity: 200,
      },
    ])
    expect(await lotOf(first.id)).toMatchObject({ onHand: 0, reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 100, reserved: 0 })
    const losses = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'loss'))
      .orderBy(asc(stockMovements.quantity))
    expect(losses.map((l) => l.quantity)).toEqual([-200, -50])
  })

  test('all merma: no sale, no cash, whole line lost', async () => {
    const { first, second, lotOf, settle } = await setup()
    const settled = await settle({ boxes: 0, units: 0 }, 500)
    expect(settled.expectedCents).toBe(0)
    expect(settled.cashMovementId).toBeNull()
    expect(await db.select().from(cashMovements)).toHaveLength(0)
    expect(await lotOf(first.id)).toMatchObject({ onHand: 0, reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 100, reserved: 0 })
  })

  test('without merma nothing is lost and scrap is zero', async () => {
    const { settle } = await setup()
    const settled = await settle({ boxes: 2, units: 6 }, 0, 470_000)
    expect(settled.lines[0].scrapQuantity).toBe(0)
    expect(
      await db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.type, 'loss')),
    ).toHaveLength(0)
  })

  test('the server enforces caps: returned + merma above assigned, negative or fractional merma', async () => {
    const { settle } = await setup()
    const state = await riderState()
    for (const [leftover, scrap] of [
      [{ boxes: 0, units: 400 }, 101],
      [{ boxes: 0, units: 0 }, 501],
      [{ boxes: 0, units: 10 }, -1],
      [{ boxes: 0, units: 10 }, 1.5],
    ] as const) {
      expect((await errorOf(() => settle(leftover, scrap))).code).toBe(
        'invalid',
      )
    }
    expect(await riderState()).toEqual(state)
    // The exact cap still works.
    const settled = await settle({ boxes: 0, units: 400 }, 100, 0)
    expect(settled.lines[0].soldQuantity).toBe(0)
  })

  test('stores scrap on allocations; sold + leftover + scrap = quantity', async () => {
    const { settle } = await setup()
    await settle({ boxes: 2, units: 6 }, 20, 450_000)
    const rows = await db.select().from(riderAllocations)
    for (const row of rows) {
      expect(
        (row.soldQuantity ?? 0) +
          (row.leftoverQuantity ?? 0) +
          (row.scrapQuantity ?? 0),
      ).toBe(row.quantity)
    }
  })
})

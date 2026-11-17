import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { ledgerSum } from '#/modules/inventory/services/testing'
import { setPrices } from '#/modules/pricing/services/prices'
import {
  assignRider,
  cancelAssignment,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import { rechargeAssignment } from '#/modules/riders/services/recharge'
import {
  errorOf,
  receive,
  riderState,
  setupRiders,
} from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

/** Two lots of milk (300 each, box of 12) and a rider on the road with 10 boxes. */
async function setup() {
  const fx = await setupRiders()
  const first = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const second = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const assigned = await assignRider(fx.staffA, {
    riderId: fx.rider.id,
    lines: [{ productId: fx.milkBox.id, boxes: 10, units: 0 }],
  })
  const lotOf = async (id: string) =>
    (await db.select().from(lots).where(eq(lots.id, id)))[0]
  const recharge = (boxes: number, units: number, assignmentId = assigned.id) =>
    rechargeAssignment(fx.staffA, {
      assignmentId,
      lines: [{ productId: fx.milkBox.id, boxes, units }],
    })
  return { fx, first, second, assigned, lotOf, recharge }
}

describe('rechargeAssignment', () => {
  test('raises the existing line and reserves FIFO from the same lots', async () => {
    const { first, second, assigned, lotOf, recharge } = await setup()
    const detail = await recharge(20, 6) // 246 more, 366 in total
    expect(detail.id).toBe(assigned.id)
    expect(detail.lines).toHaveLength(1)
    expect(detail.lines[0].assignedQuantity).toBe(366)
    expect(
      detail.lines[0].allocations.map((a) => [a.lotId, a.quantity]),
    ).toEqual([
      [first.id, 300],
      [second.id, 66],
    ])
    expect(await lotOf(first.id)).toMatchObject({ onHand: 300, reserved: 300 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 300, reserved: 66 })
    expect(
      await db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.type, 'sale')),
    ).toHaveLength(0)
  })

  test('adds a new line for a product the assignment did not have', async () => {
    const { fx, assigned } = await setup()
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    await receive(fx, { productId: fx.cola.id, quantity: 100 })
    const detail = await rechargeAssignment(fx.staffA, {
      assignmentId: assigned.id,
      lines: [{ productId: fx.cola.id, boxes: 1, units: 3 }],
    })
    expect(detail.lines).toHaveLength(2)
    const cola = detail.lines.find((l) => l.productId === fx.cola.id)!
    expect(cola).toMatchObject({ boxFactor: 24, assignedQuantity: 27 })
    expect(cola.allocations).toHaveLength(1)
    expect(
      detail.lines.find((l) => l.productId === fx.milkBox.id)!.assignedQuantity,
    ).toBe(120)
  })

  test('short stock rejects and changes nothing', async () => {
    const { fx, recharge } = await setup()
    const state = await riderState()
    // 600 received, 120 on the road: 480 free.
    expect((await errorOf(() => recharge(0, 481))).code).toBe('conflict')
    expect(await riderState()).toEqual(state)
    expect(
      (
        await errorOf(() =>
          rechargeAssignment(fx.staffA, {
            assignmentId: state.riderAssignments[0].id,
            lines: [],
          }),
        )
      ).code,
    ).toBe('invalid')
    expect(await riderState()).toEqual(state)
  })

  test('only an "En ruta" assignment can be topped up', async () => {
    const { fx, assigned, recharge } = await setup()
    const settled = await settleAssignment(fx.staffA, {
      assignmentId: assigned.id,
      deliveredCents: 0,
      lines: [{ lineId: assigned.lines[0].id, boxes: 10, units: 0 }],
    })
    const state = await riderState()
    expect((await errorOf(() => recharge(1, 0, settled.id))).message).toBe(
      'Este reparto ya no está en ruta.',
    )
    expect(await riderState()).toEqual(state)
    const again = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    })
    await cancelAssignment(fx.staffA, { assignmentId: again.id })
    const after = await riderState()
    expect((await errorOf(() => recharge(1, 0, again.id))).code).toBe(
      'conflict',
    )
    expect(await riderState()).toEqual(after)
  })

  test('access: foreign manager and customer refused, unknown assignment not found', async () => {
    const { fx, assigned } = await setup()
    const state = await riderState()
    const input = {
      assignmentId: assigned.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    }
    expect(
      (await errorOf(() => rechargeAssignment(fx.managerB, input))).code,
    ).toBe('forbidden')
    expect(
      (await errorOf(() => rechargeAssignment(fx.customerActor, input))).code,
    ).toBe('forbidden')
    expect(
      (
        await errorOf(() =>
          rechargeAssignment(fx.owner, { ...input, assignmentId: 'x' }),
        )
      ).code,
    ).toBe('not_found')
    expect(await riderState()).toEqual(state)
  })

  test('settlement after a recarga sells the whole raised line at frozen prices', async () => {
    const { fx, first, second, assigned, lotOf, recharge } = await setup()
    // The price changes after the assignment: the original 120 keep 1000,
    // the recarga freezes the new price (2000).
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.pieceId, priceCents: 2000 }],
    })
    const raised = await recharge(0, 200) // 320 in total
    expect(raised.lines[0].assignedQuantity).toBe(320)
    const settled = await settleAssignment(fx.staffA, {
      assignmentId: assigned.id,
      deliveredCents: 0,
      lines: [{ lineId: raised.lines[0].id, boxes: 0, units: 20 }], // 20 back
    })
    expect(settled.lines[0]).toMatchObject({
      assignedQuantity: 320,
      leftoverQuantity: 20,
      soldQuantity: 300,
    })
    // Lot one sold out: 120 at 1000 plus the 180 the recarga took at 2000.
    expect(settled.expectedCents).toBe(120 * 1000 + 180 * 2000)
    expect(settled.differenceCents).toBe(-(120 * 1000 + 180 * 2000))
    expect(await lotOf(first.id)).toMatchObject({ onHand: 0, reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 300, reserved: 0 })
    expect(await ledgerSum(first.id)).toBe(0)
    expect(await ledgerSum(second.id)).toBe(300)
  })

  test('cancelling after a recarga gives every unit back', async () => {
    const { fx, first, second, assigned, lotOf, recharge } = await setup()
    await recharge(5, 0)
    await cancelAssignment(fx.staffA, { assignmentId: assigned.id })
    expect(await lotOf(first.id)).toMatchObject({ reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ reserved: 0 })
  })
})

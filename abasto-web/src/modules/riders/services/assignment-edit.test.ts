import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { lots } from '#/modules/inventory/db/schema'
import { ledgerSum } from '#/modules/inventory/services/testing'
import { setPrices } from '#/modules/pricing/services/prices'
import { riderAllocations } from '#/modules/riders/db/schema'
import { editAssignmentLoad } from '#/modules/riders/services/assignment-edit'
import {
  assignRider,
  cancelAssignment,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import {
  errorOf,
  receive,
  riderState,
  setupRiders,
} from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

/** Two lots of milk (300 each, box of 12) and a rider on the road with 366 (second lot used). */
async function setup() {
  const fx = await setupRiders()
  const first = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const second = await receive(fx, { productId: fx.milkBox.id, quantity: 300 })
  const assigned = await assignRider(fx.staffA, {
    riderId: fx.rider.id,
    lines: [{ productId: fx.milkBox.id, boxes: 30, units: 6 }],
  })
  const lotOf = async (id: string) =>
    (await db.select().from(lots).where(eq(lots.id, id)))[0]
  const edit = (
    changes: Array<{ productId: string; boxes?: number; units?: number }>,
    add: Array<{ productId: string; boxes?: number; units?: number }> = [],
    assignmentId = assigned.id,
  ) => editAssignmentLoad(fx.staffA, { assignmentId, changes, add })
  return { fx, first, second, assigned, lotOf, edit }
}

describe('editAssignmentLoad', () => {
  test('lowering by boxes gives back the newest lot first', async () => {
    const { fx, first, second, assigned, lotOf, edit } = await setup()
    expect(assigned.lines[0].allocations.map((a) => a.quantity)).toEqual([
      300, 66,
    ])
    const detail = await edit([
      { productId: fx.milkBox.id, boxes: 20, units: 0 }, // 240: -126
    ])
    expect(detail.lines[0].assignedQuantity).toBe(240)
    expect(
      detail.lines[0].allocations.map((a) => [a.lotId, a.quantity]),
    ).toEqual([[first.id, 240]])
    expect(await lotOf(first.id)).toMatchObject({ onHand: 300, reserved: 240 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 300, reserved: 0 })
  })

  test('lowering by units trims only part of the newest allocation', async () => {
    const { fx, first, second, lotOf, edit } = await setup()
    const detail = await edit([
      { productId: fx.milkBox.id, boxes: 30, units: 1 }, // 361: -5
    ])
    expect(detail.lines[0].assignedQuantity).toBe(361)
    expect(detail.lines[0].allocations.map((a) => a.quantity)).toEqual([
      300, 61,
    ])
    expect(await lotOf(first.id)).toMatchObject({ reserved: 300 })
    expect(await lotOf(second.id)).toMatchObject({ reserved: 61 })
  })

  test('removing one of two lines frees its units', async () => {
    const { fx, first, assigned, lotOf, edit } = await setup()
    await receive(fx, { productId: fx.cola.id, quantity: 100 })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    await edit([], [{ productId: fx.cola.id, boxes: 1, units: 0 }])
    const detail = await edit([
      { productId: fx.milkBox.id, boxes: 0, units: 0 },
    ])
    expect(detail.lines).toHaveLength(1)
    expect(detail.lines[0].productId).toBe(fx.cola.id)
    expect(await lotOf(first.id)).toMatchObject({ reserved: 0 })
    const state = await riderState()
    expect(
      state.riderAllocations.every((a) => a.lineId !== assigned.lines[0].id),
    ).toBe(true)
  })

  test('cannot leave the assignment without lines', async () => {
    const { fx, edit } = await setup()
    const state = await riderState()
    const error = await errorOf(() =>
      edit([{ productId: fx.milkBox.id, boxes: 0, units: 0 }]),
    )
    expect(error.code).toBe('invalid')
    expect(error.message).toContain('cancélalo')
    expect(await riderState()).toEqual(state)
  })

  test('raises a line and adds a new product in one edit', async () => {
    const { fx, first, second, lotOf, edit } = await setup()
    await receive(fx, { productId: fx.cola.id, quantity: 100 })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    const detail = await edit(
      [{ productId: fx.milkBox.id, boxes: 40, units: 0 }], // 480: +114
      [{ productId: fx.cola.id, boxes: 1, units: 3 }],
    )
    expect(
      detail.lines.find((l) => l.productId === fx.milkBox.id)!.assignedQuantity,
    ).toBe(480)
    expect(
      detail.lines.find((l) => l.productId === fx.cola.id)!.assignedQuantity,
    ).toBe(27)
    expect(await lotOf(first.id)).toMatchObject({ reserved: 300 })
    expect(await lotOf(second.id)).toMatchObject({ reserved: 180 })
  })

  test('lower and add together: freed units are not needed, stock stays consistent', async () => {
    const { fx, first, second, lotOf, edit } = await setup()
    await receive(fx, { productId: fx.cola.id, quantity: 100 })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    await edit(
      [{ productId: fx.milkBox.id, boxes: 10, units: 0 }],
      [{ productId: fx.cola.id, boxes: 0, units: 10 }],
    )
    expect(await lotOf(first.id)).toMatchObject({ reserved: 120 })
    expect(await lotOf(second.id)).toMatchObject({ reserved: 0 })
  })

  test('short stock on the raise rejects and changes nothing, including lowers', async () => {
    const { fx, edit } = await setup()
    await receive(fx, { productId: fx.cola.id, quantity: 10 })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 800 }],
    })
    const state = await riderState()
    const error = await errorOf(() =>
      edit(
        [{ productId: fx.milkBox.id, boxes: 10, units: 0 }],
        [{ productId: fx.cola.id, boxes: 1, units: 0 }],
      ),
    )
    expect(error.code).toBe('conflict')
    expect(await riderState()).toEqual(state)
  })

  test('rejects unknown line, repeats, empty edit', async () => {
    const { fx, edit } = await setup()
    const state = await riderState()
    expect(
      (
        await errorOf(() =>
          edit([{ productId: fx.cola.id, boxes: 1, units: 0 }]),
        )
      ).code,
    ).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          edit(
            [{ productId: fx.milkBox.id, units: 1 }],
            [{ productId: fx.milkBox.id, units: 1 }],
          ),
        )
      ).code,
    ).toBe('invalid')
    expect((await errorOf(() => edit([]))).code).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          edit([{ productId: fx.milkBox.id, boxes: -1, units: 0 }]),
        )
      ).code,
    ).toBe('invalid')
    expect(await riderState()).toEqual(state)
  })

  test('only an "En ruta" assignment can be edited', async () => {
    const { fx, assigned, edit } = await setup()
    const settled = await settleAssignment(fx.staffA, {
      assignmentId: assigned.id,
      deliveredCents: 0,
      lines: [{ lineId: assigned.lines[0].id, boxes: 30, units: 6 }],
    })
    const error = await errorOf(() =>
      edit([{ productId: fx.milkBox.id, boxes: 1, units: 0 }], [], settled.id),
    )
    expect(error.message).toBe('Este reparto ya no está en ruta.')
    const again = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 2, units: 0 }],
    })
    await cancelAssignment(fx.staffA, { assignmentId: again.id })
    const after = await riderState()
    expect(
      (
        await errorOf(() =>
          edit(
            [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
            [],
            again.id,
          ),
        )
      ).code,
    ).toBe('conflict')
    expect(await riderState()).toEqual(after)
  })

  test('access: foreign manager and customer refused, unknown assignment not found', async () => {
    const { fx, assigned } = await setup()
    const state = await riderState()
    const input = {
      assignmentId: assigned.id,
      changes: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
      add: [],
    }
    expect(
      (await errorOf(() => editAssignmentLoad(fx.managerB, input))).code,
    ).toBe('forbidden')
    expect(
      (await errorOf(() => editAssignmentLoad(fx.customerActor, input))).code,
    ).toBe('forbidden')
    expect(
      (
        await errorOf(() =>
          editAssignmentLoad(fx.owner, { ...input, assignmentId: 'x' }),
        )
      ).code,
    ).toBe('not_found')
    expect(await riderState()).toEqual(state)
  })

  test('settlement after a lowered edit uses the edited quantity and lots end consistent', async () => {
    const { fx, first, second, assigned, lotOf, edit } = await setup()
    const edited = await edit([
      { productId: fx.milkBox.id, boxes: 20, units: 0 }, // 240
    ])
    const settled = await settleAssignment(fx.staffA, {
      assignmentId: assigned.id,
      deliveredCents: 0,
      lines: [{ lineId: edited.lines[0].id, boxes: 0, units: 40 }], // 200 sold
    })
    expect(settled.lines[0]).toMatchObject({
      assignedQuantity: 240,
      leftoverQuantity: 40,
      soldQuantity: 200,
    })
    expect(settled.expectedCents).toBe(200 * 1000)
    expect(await lotOf(first.id)).toMatchObject({ onHand: 100, reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ onHand: 300, reserved: 0 })
    expect(await ledgerSum(first.id)).toBe(100)
    expect(await ledgerSum(second.id)).toBe(300)
    // Settled allocations still split exactly.
    for (const a of await db.select().from(riderAllocations)) {
      expect(a.soldQuantity! + a.leftoverQuantity!).toBe(a.quantity)
    }
  })

  test('cancelling after an edit gives every remaining unit back', async () => {
    const { fx, first, second, assigned, lotOf, edit } = await setup()
    await edit([{ productId: fx.milkBox.id, boxes: 5, units: 0 }])
    await cancelAssignment(fx.staffA, { assignmentId: assigned.id })
    expect(await lotOf(first.id)).toMatchObject({ reserved: 0 })
    expect(await lotOf(second.id)).toMatchObject({ reserved: 0 })
  })
})

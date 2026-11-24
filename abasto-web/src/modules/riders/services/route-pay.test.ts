import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { riderAssignmentLines } from '#/modules/riders/db/schema'
import { updateProduct } from '#/modules/catalog/services/products'
import { setPrices } from '#/modules/pricing/services/prices'
import { assignRider } from '#/modules/riders/services/assignments'
import { editAssignmentLoad } from '#/modules/riders/services/assignment-edit'
import { rechargeAssignment } from '#/modules/riders/services/recharge'
import { receive, setupRiders } from '#/modules/riders/services/testing'

beforeEach(() => resetDatabase(db))

async function priceWater(fx: Awaited<ReturnType<typeof setupRiders>>) {
  await setPrices(fx.owner, {
    warehouseId: fx.a.id,
    prices: [{ presentationId: fx.box(fx.water).id, priceCents: 44_000 }],
  })
}

const routePayOf = async (lineId: string) =>
  (
    await db
      .select({ pay: riderAssignmentLines.routePayCents })
      .from(riderAssignmentLines)
      .where(eq(riderAssignmentLines.id, lineId))
  )[0].pay

describe('route pay frozen on assignment lines', () => {
  test('a new line copies the product route pay and later edits do not rewrite it', async () => {
    const fx = await setupRiders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 600 })
    await updateProduct(fx.owner, fx.milkBox.id, { routePayCents: 1500 })
    const detail = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 2, units: 0 }],
    })
    const lineId = detail.lines[0].id
    expect(await routePayOf(lineId)).toBe(1500)
    await updateProduct(fx.owner, fx.milkBox.id, { routePayCents: 2000 })
    expect(await routePayOf(lineId)).toBe(1500)
    // Recargar on the existing line keeps its frozen value.
    await rechargeAssignment(fx.staffA, {
      assignmentId: detail.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    })
    expect(await routePayOf(lineId)).toBe(1500)
  })

  test('lines added by recargar or editar carga take the current product value', async () => {
    const fx = await setupRiders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 600 })
    await priceWater(fx)
    await receive(fx, { productId: fx.water.id, quantity: 600 })
    await updateProduct(fx.owner, fx.water.id, { routePayCents: 700 })
    await updateProduct(fx.owner, fx.milkBox.id, { routePayCents: 1500 })
    const detail = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    })
    const recharged = await rechargeAssignment(fx.staffA, {
      assignmentId: detail.id,
      lines: [{ productId: fx.water.id, boxes: 1, units: 0 }],
    })
    const waterLine = recharged.lines.find((l) => l.productId === fx.water.id)!
    expect(await routePayOf(waterLine.id)).toBe(700)
    expect(waterLine.routePayCents).toBe(700)
  })

  test('default is zero', async () => {
    const fx = await setupRiders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 100 })
    const detail = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    })
    expect(await routePayOf(detail.lines[0].id)).toBe(0)
  })

  test('editar carga adding a new product freezes its value', async () => {
    const fx = await setupRiders()
    await receive(fx, { productId: fx.milkBox.id, quantity: 100 })
    await priceWater(fx)
    await receive(fx, { productId: fx.water.id, quantity: 100 })
    await updateProduct(fx.owner, fx.water.id, { routePayCents: 900 })
    const detail = await assignRider(fx.staffA, {
      riderId: fx.rider.id,
      lines: [{ productId: fx.milkBox.id, boxes: 1, units: 0 }],
    })
    const edited = await editAssignmentLoad(fx.staffA, {
      assignmentId: detail.id,
      changes: [],
      add: [{ productId: fx.water.id, boxes: 1, units: 0 }],
    })
    const line = edited.lines.find((l) => l.productId === fx.water.id)!
    expect(await routePayOf(line.id)).toBe(900)
  })
})

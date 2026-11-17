import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { updateProduct } from '#/modules/catalog/services/products'
import {
  lots,
  purchaseLines,
  purchases,
  supplierPendings,
} from '#/modules/inventory/db/schema'
import {
  cancelSupplierOrder,
  createSupplierOrder,
  editSupplierOrder,
  getSupplierOrder,
  receiveSupplierOrder,
} from '#/modules/inventory/services/supplier-orders'
import { listSupplierPendings } from '#/modules/inventory/services/supplier-pendings'
import {
  errorOf,
  lineFor,
  setupSupplierOrders,
  supplierState,
} from '#/modules/inventory/services/supplier-testing'
import type { SupplierFixture } from '#/modules/inventory/services/supplier-testing'

beforeEach(() => resetDatabase(db))

const forbidden = 'No tienes permiso para esta acción.'

/** Milk 10 boxes (13.44 a box) + soda 2 boxes (20.16 a box → 24 pieces × 0.84). */
async function pending(
  fx: SupplierFixture,
  extra: Record<string, unknown> = {},
) {
  const created = await createSupplierOrder(fx.owner, {
    supplierId: fx.supplier.id,
    warehouseId: fx.a.id,
    lines: [lineFor(fx.milk, 10), lineFor(fx.soda, 2)],
    ...extra,
  })
  return created.id
}

const edit = (
  fx: SupplierFixture,
  purchaseId: string,
  lines: Array<{ productId: string; boxes: number }>,
  actor = fx.owner,
) => editSupplierOrder(actor, { purchaseId, lines })

const boxesOf = (order: Awaited<ReturnType<typeof getSupplierOrder>>) =>
  Object.fromEntries(order.lines.map((line) => [line.productId, line.boxes]))

describe('editSupplierOrder', () => {
  test('raises, lowers and removes lines, keeping the folio and recomputing costs', async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    const before = await getSupplierOrder(fx.owner, id)
    await edit(fx, id, [lineFor(fx.milk, 12)])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order).toMatchObject({
      status: 'Pedido',
      reference: before.reference,
      folio: before.folio,
      code: before.code,
      purchasedOn: before.purchasedOn,
    })
    expect(order.lines).toHaveLength(1)
    expect(order.lines[0]).toMatchObject({
      productId: fx.milk.id,
      boxes: 12,
      quantity: 144,
      grossCostCents: 17280,
      totalCostCents: 16128,
    })
    expect(order.totalCostCents).toBe(16128)
    // The original milk line row is kept (same id), the soda one is gone.
    expect(order.lines[0].id).toBe(
      before.lines.find((line) => line.productId === fx.milk.id)!.id,
    )

    await edit(fx, id, [lineFor(fx.milk, 3), lineFor(fx.soda, 5)])
    const lowered = await getSupplierOrder(fx.owner, id)
    expect(boxesOf(lowered)).toEqual({ [fx.milk.id]: 3, [fx.soda.id]: 5 })
    expect(lowered.totalCostCents).toBe(3 * 1344 + 5 * 2016)
  })

  test('adds another product of the same supplier with catalog terms', async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    await edit(fx, id, [
      lineFor(fx.milk, 10),
      lineFor(fx.soda, 2),
      lineFor(fx.free, 4),
    ])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order.lines).toHaveLength(3)
    expect(order.lines.find((l) => l.productId === fx.free.id)).toMatchObject({
      boxes: 4,
      quantity: 24,
      totalCostCents: 0,
      ordered: true,
    })
  })

  test("existing lines keep their frozen price; added ones take today's catalog", async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    await updateProduct(fx.owner, fx.milk.id, { listPricePerPiece: 20000 })
    await updateProduct(fx.owner, fx.soda.id, { listPricePerPiece: 10000 })
    await edit(fx, id, [lineFor(fx.milk, 11), lineFor(fx.soda, 2)])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order.lines.find((l) => l.productId === fx.milk.id)).toMatchObject({
      listPricePerPiece: 12000,
      totalCostCents: 11 * 1344,
    })
    // Remove soda, add it back: now it is a new line at the new price.
    await edit(fx, id, [lineFor(fx.milk, 11)])
    await edit(fx, id, [lineFor(fx.milk, 11), lineFor(fx.soda, 1)])
    const again = await getSupplierOrder(fx.owner, id)
    expect(again.lines.find((l) => l.productId === fx.soda.id)).toMatchObject({
      listPricePerPiece: 10000,
      totalCostCents: 2400,
    })
  })

  test('refuses to leave the order without lines and suggests cancelling', async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    const before = await supplierState()
    const error = await errorOf(() => edit(fx, id, []))
    expect(error.code).toBe('invalid')
    expect(error.message).toContain('Cancelar pedido')
    expect(await supplierState()).toEqual(before)
  })

  test("rejects invalid lines, other suppliers' products and unknown products, changing nothing", async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    const before = await supplierState()
    const cases: Array<[Array<{ productId: string; boxes: number }>, string]> =
      [
        [
          [lineFor(fx.milk, 0)],
          'Las cajas deben ser un número entero mayor que cero.',
        ],
        [
          [lineFor(fx.milk, 1.5)],
          'Las cajas deben ser un número entero mayor que cero.',
        ],
        [
          [lineFor(fx.milk, 1), lineFor(fx.milk, 2)],
          'Cada producto solo puede aparecer una vez en el pedido.',
        ],
        [
          [lineFor(fx.milk, 1), lineFor(fx.cola, 2)],
          'Ese producto no pertenece a este proveedor.',
        ],
        [
          [lineFor(fx.milk, 1), { productId: crypto.randomUUID(), boxes: 1 }],
          'No encontramos ese producto.',
        ],
        [[lineFor(fx.milk, 100_000_000)], 'El pedido es demasiado grande.'],
      ]
    for (const [lines, message] of cases) {
      const error = await errorOf(() => edit(fx, id, lines))
      expect(error.message).toBe(message)
      expect(await supplierState()).toEqual(before)
    }
  })

  test('only a Pedido can be edited: received and cancelled orders are refused', async () => {
    const fx = await setupSupplierOrders()
    const received = await pending(fx)
    const order = await getSupplierOrder(fx.owner, received)
    await receiveSupplierOrder(fx.owner, {
      purchaseId: received,
      lines: order.lines.map((line) => ({
        lineId: line.id,
        receivedBoxes: line.boxes,
        damagedBoxes: 0,
        noExpiry: true,
      })),
    })
    const cancelled = await pending(fx)
    await cancelSupplierOrder(fx.owner, cancelled)
    const before = await supplierState()
    for (const target of [received, cancelled]) {
      const error = await errorOf(() => edit(fx, target, [lineFor(fx.milk, 1)]))
      expect([error.code, error.message]).toEqual([
        'conflict',
        'Solo se puede editar un pedido pendiente de recibir.',
      ])
    }
    const missing = await errorOf(() =>
      edit(fx, crypto.randomUUID(), [lineFor(fx.milk, 1)]),
    )
    expect(missing.code).toBe('not_found')
    expect(await supplierState()).toEqual(before)
  })

  test('requires warehouse.manage on the order warehouse', async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    const before = await supplierState()
    const denied = await errorOf(() =>
      edit(fx, id, [lineFor(fx.milk, 1)], fx.managerB),
    )
    expect([denied.code, denied.message]).toEqual(['forbidden', forbidden])
    expect(await supplierState()).toEqual(before)
    await edit(fx, id, [lineFor(fx.milk, 1)], fx.managerA)
    expect(boxesOf(await getSupplierOrder(fx.owner, id))).toEqual({
      [fx.milk.id]: 1,
    })
  })

  test('receiving after an edit takes the edited quantities', async () => {
    const fx = await setupSupplierOrders()
    const id = await pending(fx)
    await edit(fx, id, [lineFor(fx.milk, 4), lineFor(fx.free, 2)])
    const order = await getSupplierOrder(fx.owner, id)
    await receiveSupplierOrder(fx.owner, {
      purchaseId: id,
      lines: order.lines.map((line) => ({
        lineId: line.id,
        receivedBoxes: line.boxes,
        damagedBoxes: 0,
        noExpiry: true,
      })),
    })
    const created = await db
      .select({ productId: lots.productId, onHand: lots.onHand })
      .from(lots)
      .innerJoin(purchaseLines, eq(purchaseLines.id, lots.purchaseLineId))
      .where(eq(purchaseLines.purchaseId, id))
    const byProduct = Object.fromEntries(
      created.map((lot) => [lot.productId, lot.onHand]),
    )
    expect(byProduct).toEqual({ [fx.milk.id]: 48, [fx.free.id]: 12 })
    expect(
      (await listSupplierPendings(fx.owner, fx.supplier.id)).restock,
    ).toEqual([])
  })
})

/** A restock balance of 3 boxes of milk (4032 cents) from a received order. */
async function restockBalance(fx: SupplierFixture, known: Array<string> = []) {
  const created = await createSupplierOrder(fx.owner, {
    supplierId: fx.supplier.id,
    warehouseId: fx.a.id,
    lines: [lineFor(fx.milk, 10)],
  })
  const order = await getSupplierOrder(fx.owner, created.id)
  await receiveSupplierOrder(fx.owner, {
    purchaseId: created.id,
    lines: [
      {
        lineId: order.lines[0].id,
        receivedBoxes: 7,
        damagedBoxes: 0,
        noExpiry: true,
      },
    ],
  })
  const { restock } = await listSupplierPendings(fx.owner, fx.supplier.id)
  return restock.find((row) => !known.includes(row.pendingId))!
}

const entries = (purchaseId: string, type: 'discounted' | 'reopened') =>
  db
    .select()
    .from(supplierPendings)
    .where(eq(supplierPendings.purchaseId, purchaseId))
    .then((rows) => rows.filter((row) => row.type === type))

describe('editSupplierOrder and applied discounts', () => {
  test('keeps the discount while it still fits the new total', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await pending(fx, {
      discounts: [{ pendingId: balance.pendingId }],
    })
    const result = await edit(fx, id, [lineFor(fx.milk, 5)])
    expect(result).toEqual({ discountCents: 4032, reopened: 0 })
    expect(await getSupplierOrder(fx.owner, id)).toMatchObject({
      totalCostCents: 6720,
      discountCents: 4032,
      payableCents: 2688,
    })
    expect(await entries(id, 'reopened')).toHaveLength(0)
    expect(
      (await listSupplierPendings(fx.owner, fx.supplier.id)).restock,
    ).toEqual([])
  })

  test('reopens the discount that no longer fits and the balance is owed again', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await pending(fx, {
      discounts: [{ pendingId: balance.pendingId }],
    })
    const result = await edit(fx, id, [lineFor(fx.milk, 2)])
    expect(result).toEqual({ discountCents: 0, reopened: 1 })
    expect(await getSupplierOrder(fx.owner, id)).toMatchObject({
      totalCostCents: 2688,
      discountCents: 0,
      payableCents: 2688,
    })
    const { restock } = await listSupplierPendings(fx.owner, fx.supplier.id)
    expect(restock).toHaveLength(1)
    expect(restock[0]).toMatchObject({
      pendingId: balance.pendingId,
      owedValueCents: 4032,
    })
    const [stored] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, id))
    expect(stored.discountCents).toBe(0)
  })

  test('reopens only as many (newest first) as needed when several are applied', async () => {
    const fx = await setupSupplierOrders()
    const first = await restockBalance(fx)
    const second = await restockBalance(fx, [first.pendingId])
    const id = await pending(fx, {
      discounts: [
        { pendingId: first.pendingId },
        { pendingId: second.pendingId },
      ],
    })
    // 4032 + 4032 = 8064 fits a 10-box milk line (13440) + soda; lower to 7 boxes = 9408.
    expect(await edit(fx, id, [lineFor(fx.milk, 7)])).toEqual({
      discountCents: 8064,
      reopened: 0,
    })
    // 4 boxes = 5376: one discount (4032) fits, two don't.
    expect(await edit(fx, id, [lineFor(fx.milk, 4)])).toEqual({
      discountCents: 4032,
      reopened: 1,
    })
    const { restock } = await listSupplierPendings(fx.owner, fx.supplier.id)
    expect(restock.map((row) => row.pendingId)).toEqual([second.pendingId])
  })

  test('cancelling after an edit does not reopen a discount twice', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await pending(fx, {
      discounts: [{ pendingId: balance.pendingId }],
    })
    await edit(fx, id, [lineFor(fx.milk, 2)])
    await cancelSupplierOrder(fx.owner, id)
    expect(await entries(id, 'reopened')).toHaveLength(1)
    const { restock } = await listSupplierPendings(fx.owner, fx.supplier.id)
    expect(restock).toHaveLength(1)
    expect(restock[0].owedValueCents).toBe(4032)
  })

  test('a rejected edit leaves discounts untouched', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await pending(fx, {
      discounts: [{ pendingId: balance.pendingId }],
    })
    const before = await supplierState()
    const error = await errorOf(() =>
      edit(fx, id, [lineFor(fx.milk, 1), lineFor(fx.cola, 1)]),
    )
    expect(error.code).toBe('invalid')
    expect(await supplierState()).toEqual(before)
  })
})

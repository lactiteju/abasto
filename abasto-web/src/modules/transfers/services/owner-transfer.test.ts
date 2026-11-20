import { beforeEach, describe, expect, test } from 'bun:test'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import type { AppErrorCode } from '#/lib/errors'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { transferLines, transfers } from '#/modules/transfers/db/schema'
import {
  listTransferableBoxes,
  transferBoxes,
} from '#/modules/transfers/services/owner-transfer'
import {
  errorOf,
  ledgerSum,
  onHandOf,
  receive,
  setupTransfers,
  transferState,
} from '#/modules/transfers/services/testing'

beforeEach(() => resetDatabase(db))

type Fx = Awaited<ReturnType<typeof setupTransfers>>

// Water default presentation = box of 12 units.
const move = (
  fx: Fx,
  boxes: number,
  overrides: { toWarehouseId?: string; productId?: string } = {},
) => ({
  fromWarehouseId: fx.a.id,
  toWarehouseId: overrides.toWarehouseId ?? fx.b.id,
  lines: [{ productId: overrides.productId ?? fx.water.id, boxes }],
})

async function rejects(
  run: () => Promise<unknown>,
  code: AppErrorCode,
  message?: string,
) {
  const before = await transferState()
  const error = await errorOf(run)
  expect(error.code).toBe(code)
  if (message) expect(error.message).toBe(message)
  expect(await transferState()).toEqual(before)
}

describe('transferBoxes', () => {
  test('takes boxes FEFO across lots and keeps expiry, code, cost and price', async () => {
    const fx = await setupTransfers()
    const late = await receive(fx, {
      productId: fx.water.id,
      quantity: 24,
      totalCostCents: 2400,
      lotCode: 'LATE',
      expiresOn: '2099-06-01',
      salePriceCents: 3000,
    })
    const early = await receive(fx, {
      productId: fx.water.id,
      quantity: 18,
      totalCostCents: 1800,
      lotCode: 'EARLY',
      expiresOn: '2099-01-01',
      salePriceCents: 2000,
    })
    const { id } = await transferBoxes(fx.owner, move(fx, 2))
    // 24 units: 18 from EARLY, 6 from LATE.
    expect(await onHandOf(early.id)).toBe(0)
    expect(await onHandOf(late.id)).toBe(18)
    const destination = await db
      .select()
      .from(lots)
      .where(eq(lots.warehouseId, fx.b.id))
      .orderBy(asc(lots.expiresOn))
    expect(
      destination.map((lot) => [
        lot.code,
        lot.expiresOn,
        lot.onHand,
        lot.sourceLotId,
        lot.salePriceCents,
        lot.receivedCostCents,
      ]),
    ).toEqual([
      ['EARLY', '2099-01-01', 18, early.id, 2000, 1800],
      ['LATE', '2099-06-01', 6, late.id, 3000, 600],
    ])
    for (const lot of destination)
      expect(await ledgerSum(lot.id)).toBe(lot.onHand)
    expect(await ledgerSum(early.id)).toBe(0)
    expect(await ledgerSum(late.id)).toBe(18)
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.reference, id))
    expect(movements.map((m) => m.type).sort()).toEqual([
      'transfer_in',
      'transfer_in',
      'transfer_out',
      'transfer_out',
    ])
    const [transfer] = await db
      .select()
      .from(transfers)
      .where(eq(transfers.id, id))
    expect(transfer.status).toBe('Recibido')
    expect(transfer.closedBy).toBe(fx.owner.userId)
    const lines = await db
      .select()
      .from(transferLines)
      .where(eq(transferLines.transferId, id))
    expect(
      lines.map((line) => [line.quantity, line.receivedQuantity]).sort(),
    ).toEqual([
      [18, 18],
      [6, 6],
    ])
    expect(lines.every((line) => line.destinationLotId)).toBe(true)
  })

  test('does not take reserved or expired units', async () => {
    const fx = await setupTransfers()
    const expired = await receive(fx, {
      productId: fx.water.id,
      quantity: 12,
      expiresOn: '2099-01-01',
    })
    await db
      .update(lots)
      .set({ expiresOn: '2000-01-01' })
      .where(eq(lots.id, expired.id))
    const held = await receive(fx, {
      productId: fx.water.id,
      quantity: 24,
      expiresOn: '2099-02-01',
    })
    await db.update(lots).set({ reserved: 13 }).where(eq(lots.id, held.id))
    // Only 11 available units: not even one box.
    await rejects(
      () => transferBoxes(fx.owner, move(fx, 1)),
      'conflict',
      'No hay suficientes cajas disponibles en el origen.',
    )
    await db.update(lots).set({ reserved: 12 }).where(eq(lots.id, held.id))
    await transferBoxes(fx.owner, move(fx, 1))
    expect(await onHandOf(held.id)).toBe(12)
    expect(await onHandOf(expired.id)).toBe(12)
  })

  test('refuses more boxes than available without partial writes', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 30 })
    await rejects(
      () => transferBoxes(fx.owner, move(fx, 3)),
      'conflict',
      'No hay suficientes cajas disponibles en el origen.',
    )
  })

  test('a manager cannot transfer', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 24 })
    await rejects(() => transferBoxes(fx.managerA, move(fx, 1)), 'forbidden')
  })

  test('refuses the same warehouse', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 24 })
    await rejects(
      () => transferBoxes(fx.owner, move(fx, 1, { toWarehouseId: fx.a.id })),
      'invalid',
      'El origen y el destino del traspaso deben ser distintos.',
    )
  })

  test('refuses zero, negative and fractional boxes', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 24 })
    for (const boxes of [0, -1, 1.5, Number.NaN]) {
      await rejects(
        () => transferBoxes(fx.owner, move(fx, boxes)),
        'invalid',
        'Indica un número entero de cajas, de 1 en adelante.',
      )
    }
  })

  test('refuses a product without a default presentation', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 24 })
    await db.execute(
      (await import('drizzle-orm'))
        .sql`update presentations set is_default = false where product_id = ${fx.water.id}`,
    )
    await rejects(
      () => transferBoxes(fx.owner, move(fx, 1)),
      'invalid',
      'Ese producto no tiene una presentación predeterminada.',
    )
  })

  test('uses the default presentation factor, not a piece', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 36 })
    await transferBoxes(fx.owner, move(fx, 3))
    const moved = await db
      .select()
      .from(lots)
      .where(and(eq(lots.warehouseId, fx.b.id)))
    expect(moved.reduce((sum, lot) => sum + lot.onHand, 0)).toBe(36)
  })

  test('a product whose default is the piece moves one unit per box', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.milkBox.id, quantity: 5 })
    await transferBoxes(fx.owner, move(fx, 2, { productId: fx.milkBox.id }))
    const moved = await db
      .select()
      .from(lots)
      .where(eq(lots.warehouseId, fx.b.id))
    expect(moved.reduce((sum, lot) => sum + lot.onHand, 0)).toBe(2)
  })
})

describe('transferBoxes with several lines', () => {
  test('moves every line in one transfer', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 36 })
    await receive(fx, { productId: fx.milkBox.id, quantity: 5 })
    const { id } = await transferBoxes(fx.owner, {
      fromWarehouseId: fx.a.id,
      toWarehouseId: fx.b.id,
      lines: [
        { productId: fx.water.id, boxes: 2 },
        { productId: fx.milkBox.id, boxes: 3 },
      ],
    })
    expect(await db.select().from(transfers)).toHaveLength(1)
    const lines = await db
      .select()
      .from(transferLines)
      .where(eq(transferLines.transferId, id))
    expect(lines.map((line) => [line.productId, line.quantity]).sort()).toEqual(
      [
        [fx.water.id, 24],
        [fx.milkBox.id, 3],
      ].sort(),
    )
    const moved = await db
      .select()
      .from(lots)
      .where(eq(lots.warehouseId, fx.b.id))
    expect(moved.reduce((sum, lot) => sum + lot.onHand, 0)).toBe(27)
  })

  test('rolls everything back when one line lacks stock', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 36 })
    await receive(fx, { productId: fx.milkBox.id, quantity: 1 })
    await rejects(
      () =>
        transferBoxes(fx.owner, {
          fromWarehouseId: fx.a.id,
          toWarehouseId: fx.b.id,
          lines: [
            { productId: fx.water.id, boxes: 1 },
            { productId: fx.milkBox.id, boxes: 2 },
          ],
        }),
      'conflict',
      'No hay suficientes cajas disponibles en el origen.',
    )
  })

  test('refuses duplicated products and empty transfers', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 36 })
    await rejects(
      () =>
        transferBoxes(fx.owner, {
          fromWarehouseId: fx.a.id,
          toWarehouseId: fx.b.id,
          lines: [
            { productId: fx.water.id, boxes: 1 },
            { productId: fx.water.id, boxes: 1 },
          ],
        }),
      'invalid',
      'Cada producto solo puede aparecer una vez en el traspaso.',
    )
    await rejects(
      () =>
        transferBoxes(fx.owner, {
          fromWarehouseId: fx.a.id,
          toWarehouseId: fx.b.id,
          lines: [],
        }),
      'invalid',
      'Agrega al menos un producto al traspaso.',
    )
  })
})

describe('listTransferableBoxes', () => {
  test('lists whole available boxes per product, owner only', async () => {
    const fx = await setupTransfers()
    await receive(fx, { productId: fx.water.id, quantity: 30 })
    expect(await listTransferableBoxes(fx.owner, fx.a.id)).toEqual([
      expect.objectContaining({
        productId: fx.water.id,
        boxes: 2,
        sku: expect.any(String),
        imageUrl: null,
      }),
    ])
    expect(await listTransferableBoxes(fx.owner, fx.b.id)).toEqual([])
    expect(
      (await errorOf(() => listTransferableBoxes(fx.managerA, fx.a.id))).code,
    ).toBe('forbidden')
  })
})

import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { lots, stockMovements } from '#/modules/inventory/db/schema'
import { registerProductLoss } from '#/modules/inventory/services/product-loss'
import {
  errorOf,
  inventoryState,
  ledgerSum,
  onHandOf,
  receive,
  setupInventory,
} from '#/modules/inventory/services/testing'

beforeEach(() => resetDatabase(db))

const notEnough = 'No hay suficientes piezas disponibles para dar de baja.'

async function setup() {
  const fx = await setupInventory()
  const early = await receive(fx, { quantity: 4, expiresOn: '2026-12-01' })
  const late = await receive(fx, { quantity: 10, expiresOn: '2026-12-30' })
  const soda = await receive(fx, { productId: fx.soda.id, quantity: 5 })
  return { fx, early, late, soda }
}

describe('registerProductLoss', () => {
  test('takes several products FEFO as loss movements in one go', async () => {
    const { fx, early, late, soda } = await setup()
    const result = await registerProductLoss(fx.owner, {
      warehouseId: fx.a.id,
      category: 'dañado',
      note: ' Se cayó ',
      lines: [
        { productId: fx.milk.id, pieces: 6 },
        { productId: fx.soda.id, pieces: 5 },
      ],
    })
    expect(result).toEqual({ pieces: 11 })
    expect(await onHandOf(early.id)).toBe(0)
    expect(await onHandOf(late.id)).toBe(8)
    expect(await onHandOf(soda.id)).toBe(0)
    expect(await ledgerSum(late.id)).toBe(8)
    const losses = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'loss'))
    expect(losses).toHaveLength(3)
    expect(losses.map((row) => row.reason)).toEqual(
      Array(3).fill('dañado: Se cayó'),
    )
  })

  test('without a note the reason is the category', async () => {
    const { fx } = await setup()
    await registerProductLoss(fx.owner, {
      warehouseId: fx.a.id,
      category: 'caducado',
      lines: [{ productId: fx.milk.id, pieces: 1 }],
    })
    const [movement] = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'loss'))
    expect(movement.reason).toBe('caducado')
  })

  test('refuses an overdraw and leaves every line untouched', async () => {
    const { fx } = await setup()
    const before = await inventoryState()
    const error = await errorOf(() =>
      registerProductLoss(fx.owner, {
        warehouseId: fx.a.id,
        category: 'dañado',
        lines: [
          { productId: fx.milk.id, pieces: 3 },
          { productId: fx.soda.id, pieces: 6 },
        ],
      }),
    )
    expect(error.code).toBe('conflict')
    expect(error.message).toBe(notEnough)
    expect(await inventoryState()).toEqual(before)
  })

  test('held units cannot be removed', async () => {
    const { fx, early, late } = await setup()
    await db.update(lots).set({ reserved: 4 }).where(eq(lots.id, early.id))
    const error = await errorOf(() =>
      registerProductLoss(fx.owner, {
        warehouseId: fx.a.id,
        category: 'dañado',
        lines: [{ productId: fx.milk.id, pieces: 11 }],
      }),
    )
    expect(error.message).toBe(notEnough)
    await registerProductLoss(fx.owner, {
      warehouseId: fx.a.id,
      category: 'dañado',
      lines: [{ productId: fx.milk.id, pieces: 10 }],
    })
    expect(await onHandOf(early.id)).toBe(4)
    expect(await onHandOf(late.id)).toBe(0)
  })

  test('only the owner may, and input is validated', async () => {
    const { fx } = await setup()
    const base = {
      warehouseId: fx.a.id,
      category: 'dañado' as const,
      lines: [{ productId: fx.milk.id, pieces: 1 }],
    }
    expect(
      (await errorOf(() => registerProductLoss(fx.managerA, base))).code,
    ).toBe('forbidden')
    expect(
      (
        await errorOf(() =>
          registerProductLoss(fx.owner, { ...base, lines: [] }),
        )
      ).code,
    ).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          registerProductLoss(fx.owner, {
            ...base,
            lines: [{ productId: fx.milk.id, pieces: 0 }],
          }),
        )
      ).code,
    ).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          registerProductLoss(fx.owner, {
            ...base,
            lines: [...base.lines, ...base.lines],
          }),
        )
      ).code,
    ).toBe('invalid')
    expect(
      (
        await errorOf(() =>
          registerProductLoss(fx.owner, { ...base, category: 'otro' as never }),
        )
      ).code,
    ).toBe('invalid')
  })
})

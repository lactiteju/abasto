import { beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { editLoss, voidLoss } from '#/modules/inventory/services/loss-edit'
import { registerProductLoss } from '#/modules/inventory/services/product-loss'
import { appendMovement } from '#/modules/inventory/services/stock-ledger'
import { listLossMovements } from '#/modules/inventory/services/stock-reads'
import {
  errorOf,
  ledgerSum,
  onHandOf,
  receive,
  setupInventory,
} from '#/modules/inventory/services/testing'
import type { Fixture } from '#/modules/inventory/services/testing'

beforeEach(() => resetDatabase(db))

const losses = (fx: Fixture) =>
  listLossMovements(fx.owner, { warehouseId: fx.a.id, withCost: true })

async function setup(pieces = 6) {
  const fx = await setupInventory()
  const lot = await receive(fx, {
    quantity: 10,
    expiresOn: '2026-12-01',
    totalCostCents: 5000,
  })
  await registerProductLoss(fx.owner, {
    warehouseId: fx.a.id,
    category: 'dañado',
    note: 'Se cayó',
    lines: [{ productId: fx.milk.id, pieces }],
  })
  const [loss] = await losses(fx)
  return { fx, lot, loss: loss }
}

describe('editLoss', () => {
  test('fewer pieces give the difference back to the lot and keep the original date', async () => {
    const { fx, lot, loss } = await setup()
    await editLoss(fx.owner, {
      movementId: loss.id,
      pieces: 2,
      category: 'caducado',
      note: '',
    })
    expect(await onHandOf(lot.id)).toBe(8)
    expect(await ledgerSum(lot.id)).toBe(8)
    const rows = await losses(fx)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      quantity: 2,
      reason: 'caducado',
      costCents: 1000,
      editable: true,
      editedBy: 'Dueño',
    })
    expect(rows[0].createdAt.getTime()).toBe(loss.createdAt.getTime())
    expect(rows[0].editedAt).toBeInstanceOf(Date)
  })

  test('more pieces take them from the same lot, and an edit can be edited again', async () => {
    const { fx, lot, loss } = await setup()
    await editLoss(fx.owner, {
      movementId: loss.id,
      pieces: 9,
      category: 'dañado',
      note: 'Se cayó',
    })
    expect(await onHandOf(lot.id)).toBe(1)
    const [edited] = await losses(fx)
    await editLoss(fx.owner, {
      movementId: edited.id,
      pieces: 4,
      category: 'otro',
      note: 'Robo',
    })
    expect(await onHandOf(lot.id)).toBe(6)
    const rows = await losses(fx)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ quantity: 4, reason: 'otro: Robo' })
    expect(rows[0].createdAt.getTime()).toBe(loss.createdAt.getTime())
  })

  test('refuses more pieces than the lot has free', async () => {
    const { fx, lot, loss } = await setup()
    const error = await errorOf(() =>
      editLoss(fx.owner, {
        movementId: loss.id,
        pieces: 11,
        category: 'dañado',
        note: '',
      }),
    )
    expect(error.message).toBe('El lote solo tiene 10 piezas disponibles.')
    expect(await onHandOf(lot.id)).toBe(4)
  })

  test('a stale row (already edited) is refused', async () => {
    const { fx, loss } = await setup()
    const input = {
      movementId: loss.id,
      pieces: 3,
      category: 'dañado' as const,
      note: '',
    }
    await editLoss(fx.owner, input)
    const error = await errorOf(() => editLoss(fx.owner, input))
    expect(error.code).toBe('conflict')
  })

  test('validates pieces and «otro» needs a note', async () => {
    const { fx, loss } = await setup()
    const zero = await errorOf(() =>
      editLoss(fx.owner, {
        movementId: loss.id,
        pieces: 0,
        category: 'dañado',
        note: '',
      }),
    )
    expect(zero.code).toBe('invalid')
    const other = await errorOf(() =>
      editLoss(fx.owner, {
        movementId: loss.id,
        pieces: 2,
        category: 'otro',
        note: ' ',
      }),
    )
    expect(other.code).toBe('invalid')
  })

  test('owner only', async () => {
    const { fx, loss } = await setup()
    const error = await errorOf(() =>
      editLoss(fx.managerA, {
        movementId: loss.id,
        pieces: 2,
        category: 'dañado',
        note: '',
      }),
    )
    expect(error.code).toBe('forbidden')
  })

  test('losses written by another process (a rider settlement) are not editable', async () => {
    const fx = await setupInventory()
    const lot = await receive(fx, { quantity: 10 })
    await db.transaction((tx) =>
      appendMovement(tx, lot, {
        type: 'loss',
        quantity: -2,
        reason: 'dañado: Reparto Beto',
        reference: '00000000-0000-0000-0000-000000000001',
        actorId: fx.owner.userId,
      }),
    )
    const [row] = await losses(fx)
    expect(row.editable).toBe(false)
    const error = await errorOf(() =>
      editLoss(fx.owner, {
        movementId: row.id,
        pieces: 1,
        category: 'dañado',
        note: '',
      }),
    )
    expect(error.code).toBe('invalid')
    expect(await onHandOf(lot.id)).toBe(8)
  })
})

describe('voidLoss', () => {
  test('gives every piece back and the merma leaves the list', async () => {
    const { fx, lot, loss } = await setup()
    await voidLoss(fx.owner, { movementId: loss.id })
    expect(await onHandOf(lot.id)).toBe(10)
    expect(await ledgerSum(lot.id)).toBe(10)
    expect(await losses(fx)).toEqual([])
    const again = await errorOf(() =>
      voidLoss(fx.owner, { movementId: loss.id }),
    )
    expect(again.code).toBe('conflict')
  })
})

import { beforeEach, describe, expect, test } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import {
  lots,
  purchaseLines,
  purchases,
  supplierPendings,
} from '#/modules/inventory/db/schema'
import { lockSupplier } from '#/modules/inventory/services/supplier-balance'
import {
  cancelSupplierOrder,
  createSupplierOrder,
  editSupplierOrder,
  getSupplierOrder,
  receiveSupplierOrder,
} from '#/modules/inventory/services/supplier-orders'
import { listSupplierPendings } from '#/modules/inventory/services/supplier-pendings'
import {
  lineFor,
  setupSupplierOrders,
} from '#/modules/inventory/services/supplier-testing'
import type { SupplierFixture } from '#/modules/inventory/services/supplier-testing'
import type { Tx } from '#/modules/inventory/services/stock-ledger'

beforeEach(() => resetDatabase(db))

const notPending = 'Solo se puede editar un pedido pendiente de recibir.'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits until `count` database sessions are blocked on a lock. */
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

/**
 * Holds `lock` in a helper transaction, starts `ops` one after another (each
 * waits behind it, so they queue in that order), then lets them all go.
 */
async function forced(
  lock: (tx: Tx) => Promise<unknown>,
  ops: Array<() => Promise<unknown>>,
) {
  let release = () => {}
  let held = () => {}
  const holding = new Promise<void>((resolve) => (held = resolve))
  const helper = db.transaction(async (tx) => {
    await lock(tx)
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

const holdOrder = (purchaseId: string) => (tx: Tx) =>
  tx
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .for('update')
const holdSupplier = (fx: SupplierFixture) => (tx: Tx) =>
  lockSupplier(tx, fx.supplier.id)

const messageOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as Error).message : 'ok'
const noDeadlock = (results: Array<PromiseSettledResult<unknown>>) =>
  expect(
    results.filter(
      (r) =>
        r.status === 'rejected' &&
        (r.reason as { cause?: { code?: string } }).cause?.code === '40P01',
    ),
  ).toEqual([])

/**
 * Ledger invariants: every origin balance is settled between 0 and its value
 * and discounted at most once at a time; each order's stored discount equals
 * its discounted − reopened entries, never exceeds its net total, and a
 * cancelled order holds none; an order never reopens more than it took.
 */
async function expectLedgerConsistent() {
  const entries = await db.select().from(supplierPendings)
  const origins = entries.filter((entry) => !entry.settlesId)
  for (const origin of origins) {
    const settling = entries.filter((entry) => entry.settlesId === origin.id)
    const settled = 0 - settling.reduce((sum, e) => sum + e.valueCents, 0) || 0
    const units = 0 - settling.reduce((sum, e) => sum + e.quantity, 0) || 0
    expect(settled).toBeGreaterThanOrEqual(0)
    expect(settled).toBeLessThanOrEqual(origin.valueCents)
    expect(units).toBeGreaterThanOrEqual(0)
    expect(units).toBeLessThanOrEqual(origin.quantity)
    const active =
      settling.filter((e) => e.type === 'discounted').length -
      settling.filter((e) => e.type === 'reopened').length
    expect([0, 1]).toContain(active)
  }
  const orders = await db
    .select({
      id: purchases.id,
      status: purchases.status,
      discountCents: purchases.discountCents,
      net: sql<number>`coalesce((select sum(pl.total_cost_cents) from purchase_lines as pl where pl.purchase_id = "purchases"."id"), 0)::int`,
    })
    .from(purchases)
  for (const order of orders) {
    const own = entries.filter(
      (e) =>
        e.purchaseId === order.id &&
        (e.type === 'discounted' || e.type === 'reopened'),
    )
    expect(0 - own.reduce((sum, e) => sum + e.valueCents, 0) || 0).toBe(
      order.discountCents,
    )
    expect(order.discountCents).toBeLessThanOrEqual(order.net)
    if (order.status === 'Cancelado') expect(order.discountCents).toBe(0)
    const bySettles = new Map<string, number>()
    for (const e of own) {
      const delta = e.type === 'discounted' ? 1 : -1
      bySettles.set(e.settlesId!, (bySettles.get(e.settlesId!) ?? 0) + delta)
    }
    for (const count of bySettles.values()) expect([0, 1]).toContain(count)
  }
}

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

/** Milk 10 + soda 2 (net 17472) with the given balances discounted. */
async function discountedOrder(fx: SupplierFixture, pendingIds: Array<string>) {
  const created = await createSupplierOrder(fx.owner, {
    supplierId: fx.supplier.id,
    warehouseId: fx.a.id,
    lines: [lineFor(fx.milk, 10), lineFor(fx.soda, 2)],
    discounts: pendingIds.map((pendingId) => ({ pendingId })),
  })
  return created.id
}

const edit = (
  fx: SupplierFixture,
  purchaseId: string,
  lines: Array<{ productId: string; boxes: number }>,
) => editSupplierOrder(fx.owner, { purchaseId, lines })

const receiveAll = (
  fx: SupplierFixture,
  purchaseId: string,
  lines: Array<{ id: string; boxes: number }>,
  replacements?: Array<{ pendingId: string; boxes: number }>,
) =>
  receiveSupplierOrder(fx.owner, {
    purchaseId,
    lines: lines.map((line) => ({
      lineId: line.id,
      receivedBoxes: line.boxes,
      damagedBoxes: 0,
      noExpiry: true,
    })),
    replacements: replacements?.map((item) => ({ ...item, noExpiry: true })),
  })

const openRestock = async (fx: SupplierFixture) =>
  (await listSupplierPendings(fx.owner, fx.supplier.id)).restock.map(
    (row) => [row.pendingId, row.owedValueCents] as const,
  )

describe('editSupplierOrder under forced races', () => {
  test('edit then reception: the reception receives the edited order and payable', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const before = await getSupplierOrder(fx.owner, id)
    const ids = Object.fromEntries(
      before.lines.map((line) => [line.productId, line.id]),
    )
    const results = await forced(holdOrder(id), [
      // 1344 + 2016 = 3360 < 4032: the discount is reopened.
      () => edit(fx, id, [lineFor(fx.milk, 1), lineFor(fx.soda, 1)]),
      () =>
        receiveAll(fx, id, [
          { id: ids[fx.milk.id], boxes: 1 },
          { id: ids[fx.soda.id], boxes: 1 },
        ]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order).toMatchObject({
      status: 'Recibido',
      totalCostCents: 3360,
      discountCents: 0,
      payableCents: 3360,
    })
    const received = await db
      .select({ productId: lots.productId, onHand: lots.onHand })
      .from(lots)
      .innerJoin(purchaseLines, eq(purchaseLines.id, lots.purchaseLineId))
      .where(eq(purchaseLines.purchaseId, id))
    expect(
      Object.fromEntries(received.map((lot) => [lot.productId, lot.onHand])),
    ).toEqual({ [fx.milk.id]: 12, [fx.soda.id]: 24 })
    expect(await openRestock(fx)).toEqual([[balance.pendingId, 4032]])
    await expectLedgerConsistent()
  })

  test('edit removing a line then a stale reception: the reception is refused', async () => {
    const fx = await setupSupplierOrders()
    const id = await discountedOrder(fx, [])
    const before = await getSupplierOrder(fx.owner, id)
    const results = await forced(holdOrder(id), [
      () => edit(fx, id, [lineFor(fx.milk, 3)]),
      () => receiveAll(fx, id, before.lines),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual([
      'ok',
      'Captura la recepción de todas las líneas del pedido.',
    ])
    expect((await getSupplierOrder(fx.owner, id)).status).toBe('Pedido')
    await expectLedgerConsistent()
  })

  test('reception then edit: the edit is refused and the discount stays', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const before = await getSupplierOrder(fx.owner, id)
    const results = await forced(holdOrder(id), [
      () => receiveAll(fx, id, before.lines),
      () => edit(fx, id, [lineFor(fx.milk, 1)]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', notPending])
    expect(await getSupplierOrder(fx.owner, id)).toMatchObject({
      status: 'Recibido',
      totalCostCents: 17472,
      discountCents: 4032,
    })
    expect(await openRestock(fx)).toEqual([])
    await expectLedgerConsistent()
  })

  test('edit then cancel: the reopened discount is never reopened twice', async () => {
    const fx = await setupSupplierOrders()
    const first = await restockBalance(fx)
    const second = await restockBalance(fx, [first.pendingId])
    const id = await discountedOrder(fx, [first.pendingId, second.pendingId])
    const results = await forced(holdOrder(id), [
      // 4 boxes = 5376: only the newest discount is reopened.
      () => edit(fx, id, [lineFor(fx.milk, 4)]),
      () => cancelSupplierOrder(fx.owner, id),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const reopened = await db
      .select({ settlesId: supplierPendings.settlesId })
      .from(supplierPendings)
      .where(eq(supplierPendings.type, 'reopened'))
    expect(reopened).toHaveLength(2)
    expect(new Set(reopened.map((row) => row.settlesId)).size).toBe(2)
    expect(new Map(await openRestock(fx))).toEqual(
      new Map([
        [first.pendingId, 4032],
        [second.pendingId, 4032],
      ]),
    )
    await expectLedgerConsistent()
  })

  test('cancel then edit: the edit is refused, discounts reopened once', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const results = await forced(holdOrder(id), [
      () => cancelSupplierOrder(fx.owner, id),
      () => edit(fx, id, [lineFor(fx.milk, 1)]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', notPending])
    expect(await openRestock(fx)).toEqual([[balance.pendingId, 4032]])
    await expectLedgerConsistent()
  })

  test('edit reopening a discount then a new order taking it: the new order gets it', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const results = await forced(holdSupplier(fx), [
      () => edit(fx, id, [lineFor(fx.milk, 1)]),
      () => discountedOrder(fx, [balance.pendingId]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const other = (results[1] as PromiseFulfilledResult<string>).value
    expect((await getSupplierOrder(fx.owner, id)).discountCents).toBe(0)
    expect((await getSupplierOrder(fx.owner, other)).discountCents).toBe(4032)
    expect(await openRestock(fx)).toEqual([])
    await expectLedgerConsistent()
  })

  test('a new order taking the discount first: it is refused as closed, the edit still reopens', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const results = await forced(holdSupplier(fx), [
      () => discountedOrder(fx, [balance.pendingId]),
      () => edit(fx, id, [lineFor(fx.milk, 1)]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['Ese saldo ya está cerrado.', 'ok'])
    expect(await openRestock(fx)).toEqual([[balance.pendingId, 4032]])
    await expectLedgerConsistent()
  })

  test('edit reopening a balance then a reception replacing it: settled once', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const plain = await discountedOrder(fx, [])
    const plainOrder = await getSupplierOrder(fx.owner, plain)
    const results = await forced(holdSupplier(fx), [
      () => edit(fx, id, [lineFor(fx.milk, 1)]),
      () =>
        receiveAll(fx, plain, plainOrder.lines, [
          { pendingId: balance.pendingId, boxes: 3 },
        ]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    expect(await openRestock(fx)).toEqual([])
    await expectLedgerConsistent()
  })

  test('two edits: applied in order, the discount reopened once', async () => {
    const fx = await setupSupplierOrders()
    const balance = await restockBalance(fx)
    const id = await discountedOrder(fx, [balance.pendingId])
    const results = await forced(holdOrder(id), [
      () => edit(fx, id, [lineFor(fx.milk, 2)]),
      () => edit(fx, id, [lineFor(fx.milk, 1), lineFor(fx.free, 3)]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order.lines.map((l) => [l.productId, l.boxes]).sort()).toEqual(
      [
        [fx.milk.id, 1],
        [fx.free.id, 3],
      ].sort(),
    )
    expect(order.discountCents).toBe(0)
    const reopened = await db
      .select()
      .from(supplierPendings)
      .where(eq(supplierPendings.type, 'reopened'))
    expect(reopened).toHaveLength(1)
    await expectLedgerConsistent()
  })

  test('two edits raising back after lowering: nothing is discounted anew', async () => {
    const fx = await setupSupplierOrders()
    const first = await restockBalance(fx)
    const second = await restockBalance(fx, [first.pendingId])
    const id = await discountedOrder(fx, [first.pendingId, second.pendingId])
    const results = await forced(holdOrder(id), [
      () => edit(fx, id, [lineFor(fx.milk, 4)]),
      () => edit(fx, id, [lineFor(fx.milk, 10), lineFor(fx.soda, 2)]),
    ])
    noDeadlock(results)
    expect(results.map(messageOf)).toEqual(['ok', 'ok'])
    expect((await getSupplierOrder(fx.owner, id)).discountCents).toBe(4032)
    expect(await openRestock(fx)).toEqual([[second.pendingId, 4032]])
    await expectLedgerConsistent()
  })
})

describe('editSupplierOrder keeps hidden lines', () => {
  test('a line whose product was archived is kept when the editor sends it back', async () => {
    const fx = await setupSupplierOrders()
    const id = await discountedOrder(fx, [])
    await db.execute(
      sql`update products set archived_at = now() where id = ${fx.soda.id}`,
    )
    await edit(fx, id, [lineFor(fx.milk, 3), lineFor(fx.soda, 2)])
    const order = await getSupplierOrder(fx.owner, id)
    expect(order.lines.map((l) => [l.productId, l.boxes]).sort()).toEqual(
      [
        [fx.milk.id, 3],
        [fx.soda.id, 2],
      ].sort(),
    )
    await expectLedgerConsistent()
  })
})

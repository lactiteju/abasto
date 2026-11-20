import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { setPrices } from '#/modules/pricing/services/prices'
import { getMonthlyResults } from '#/modules/reports/services/monthly-results'
import { getSalesReport } from '#/modules/reports/services/sales-report'
import {
  errorOf,
  farFuture,
  receive,
  setupReports,
  useClock,
} from '#/modules/reports/services/testing'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

const month = '2026-11'
const forbidden = 'No tienes permiso para esta acción.'
const setToday = (iso: string) => useClock(() => new Date(iso))

async function stocked() {
  const fx = await setupReports()
  await receive(fx, {
    productId: fx.milkBox.id,
    quantity: 100,
    totalCostCents: 1200,
    expiresOn: farFuture,
  })
  return fx
}

describe('monthly results', () => {
  test('daily totals match the sales report of the same range', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 15 })
    await fx.sell({ at: '2026-11-04T18:00:00Z', quantity: 5 })
    setToday('2026-11-30T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, { month })
    const report = await getSalesReport(fx.owner, {
      period: { preset: 'custom', from: '2026-11-01', to: '2026-11-30' },
    })
    expect(data!.range).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(data!.through).toBe('2026-11-30')
    expect(data!.totals).toMatchObject({
      orders: report.summary.orders,
      revenueCents: report.summary.revenueCents,
      costCents: report.summary.costCents,
      marginCents: report.summary.marginCents,
    })
    for (const entry of report.byDay) {
      expect(data!.byDay.find((item) => item.day === entry.name)).toMatchObject(
        {
          orders: entry.orders,
          revenueCents: entry.revenueCents,
          costCents: entry.costCents,
          marginCents: entry.marginCents,
        },
      )
    }
    expect(data!.byDay.map((item) => item.day)).toEqual(data!.days)
  })

  test('boxes by day: a box sale and a loose-piece sale make fractions', async () => {
    const fx = await stocked()
    await fx.sell({
      at: '2026-11-02T18:00:00Z',
      quantity: 2,
      presentationId: fx.boxId,
    })
    await fx.sell({ at: '2026-11-03T18:00:00Z', quantity: 6 })
    setToday('2026-11-30T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, { month })
    expect(data!.byDay.find((d) => d.day === '2026-11-02')!.boxes).toBe(2)
    expect(data!.byDay.find((d) => d.day === '2026-11-03')!.boxes).toBe(0.5)
    expect(data!.totals.boxes).toBe(2.5)
    const [row] = data!.products
    expect(row).toMatchObject({
      productId: fx.milkBox.id,
      boxName: 'Caja',
      boxFactor: 12,
      boxesByDay: { '2026-11-02': 2, '2026-11-03': 0.5 },
      boxes: 2.5,
      revenueCents: 24000 + 6000,
    })
    expect(row.marginPerBoxCents).toBe(Math.round(row.marginCents / 2.5))
  })

  test('Sundays show only with sales; days after through stay as empty rows', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 1 })
    setToday('2026-11-10T18:00:00Z')
    const quiet = (await getMonthlyResults(fx.owner, { month })).data!
    expect(quiet.through).toBe('2026-11-10')
    expect(quiet.days).not.toContain('2026-11-01')
    expect(quiet.days).not.toContain('2026-11-08')
    expect(quiet.days).toContain('2026-11-02')
    expect(quiet.days).toContain('2026-11-30')
    expect(quiet.days).toHaveLength(25)
    expect(quiet.byDay.find((d) => d.day === '2026-11-30')).toMatchObject({
      orders: 0,
      revenueCents: 0,
      boxes: 0,
    })

    await fx.sell({ at: '2026-11-08T18:00:00Z', quantity: 1 })
    setToday('2026-11-10T18:00:00Z')
    const busy = (await getMonthlyResults(fx.owner, { month })).data!
    expect(busy.days).toContain('2026-11-08')
    expect(busy.days).toHaveLength(26)
    expect(busy.totals.revenueCents).toBe(2000)
  })

  test('a past month ends on its last day; malformed and future months are refused', async () => {
    const fx = await stocked()
    setToday('2026-11-10T18:00:00Z')
    const past = (await getMonthlyResults(fx.owner, { month: '2026-10' })).data!
    expect(past.through).toBe('2026-10-31')
    for (const bad of ['2026-13', '2026-1', 'nov', '2026-12', '2027-01']) {
      const error = await errorOf(() =>
        getMonthlyResults(fx.owner, { month: bad }),
      )
      expect(error.code).toBe('invalid')
    }
  })

  test('manager sees only the managed warehouse; others are refused', async () => {
    const fx = await stocked()
    await receive(fx, {
      productId: fx.milkBox.id,
      warehouseId: fx.b.id,
      quantity: 50,
      totalCostCents: 600,
      expiresOn: farFuture,
    })
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 3 })
    await fx.sell({
      at: '2026-11-02T19:00:00Z',
      quantity: 2,
      warehouseId: fx.b.id,
    })
    setToday('2026-11-30T18:00:00Z')
    const all = await getMonthlyResults(fx.owner, { month })
    expect(all.data!.totals.revenueCents).toBe(5000)
    const one = await getMonthlyResults(fx.owner, {
      month,
      warehouseId: fx.b.id,
    })
    expect(one.data!.totals.revenueCents).toBe(2000)

    const mine = await getMonthlyResults(fx.managerB, { month })
    expect(mine.warehouses.map((w) => w.id)).toEqual([fx.b.id])
    expect(mine.data!.totals.revenueCents).toBe(2000)
    const refused = await errorOf(() =>
      getMonthlyResults(fx.managerB, { month, warehouseId: fx.a.id }),
    )
    expect(refused.message).toBe(forbidden)
    const inA = await getMonthlyResults(fx.managerA, { month })
    expect(inA.data!.totals.revenueCents).toBe(3000)
  })

  test('supplier filter keeps only that supplier’s products', async () => {
    const fx = await stocked()
    await receive(fx, {
      productId: fx.cola.id,
      quantity: 48,
      totalCostCents: 4800,
      expiresOn: farFuture,
    })
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.piece(fx.cola).id, priceCents: 500 }],
    })
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 4 })
    await fx.sell({
      at: '2026-11-02T19:00:00Z',
      quantity: 6,
      presentationId: fx.piece(fx.cola).id,
    })
    setToday('2026-11-30T18:00:00Z')
    const both = (await getMonthlyResults(fx.owner, { month })).data!
    const sold = both.products.filter((p) => p.boxes > 0)
    expect(sold.map((p) => p.productId).sort()).toEqual(
      [fx.milkBox.id, fx.cola.id].sort(),
    )
    const cola = (
      await getMonthlyResults(fx.owner, { month, supplierId: fx.cocaCola.id })
    ).data!
    expect(cola.products.map((p) => p.productId)).toEqual([fx.cola.id])
    expect(cola.totals.revenueCents).toBe(3000)
    expect(cola.products[0]).toMatchObject({ boxFactor: 24, boxes: 0.25 })
  })

  test('previous month totals use the same scope', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-10-14T18:00:00Z', quantity: 12 })
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 24 })
    setToday('2026-11-10T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, { month })
    expect(data!.previous).toMatchObject({
      orders: 1,
      revenueCents: 12000,
      boxes: 1,
    })
    expect(data!.totals).toMatchObject({
      orders: 1,
      revenueCents: 24000,
      boxes: 2,
    })
    const january = (await getMonthlyResults(fx.owner, { month: '2026-01' }))
      .data!
    expect(january.previous.orders).toBe(0)
    expect(january.products.every((p) => p.boxes === 0)).toBe(true)
  })
})

describe('monthly results: every product of the scope', () => {
  test('unsold active products come back with zeros after the sold ones', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 12 })
    setToday('2026-11-30T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, { month })
    const ids = data!.products.map((p) => p.productId)
    expect(ids.length).toBeGreaterThan(3)
    expect(ids[0]).toBe(fx.milkBox.id)
    const unsold = data!.products.slice(1)
    for (const row of unsold) {
      expect(row).toMatchObject({
        boxes: 0,
        revenueCents: 0,
        costCents: 0,
        marginCents: 0,
        marginPerBoxCents: null,
        boxesByDay: {},
      })
      expect(row.boxFactor).toBeGreaterThanOrEqual(1)
    }
    expect(data!.totals.boxes).toBe(1)
  })

  test('position is the catalog order (name, then SKU) and sorting keeps margin first', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 12 })
    setToday('2026-11-30T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, { month })
    const catalog = [...data!.products].sort((a, b) => a.position - b.position)
    expect(catalog.map((p) => p.position)).toEqual(
      catalog.map((_, index) => index),
    )
    expect(catalog.map((p) => p.name)).toEqual(
      [...catalog.map((p) => p.name)].sort((a, b) => a.localeCompare(b)),
    )
    const unsold = data!.products.slice(1)
    expect(unsold.map((p) => p.position)).toEqual(
      [...unsold.map((p) => p.position)].sort((a, b) => a - b),
    )
  })

  test('the supplier filter drops unsold products of other suppliers', async () => {
    const fx = await stocked()
    await fx.sell({ at: '2026-11-02T18:00:00Z', quantity: 12 })
    setToday('2026-11-30T18:00:00Z')
    const { data } = await getMonthlyResults(fx.owner, {
      month,
      supplierId: fx.cocaCola.id,
    })
    expect(data!.products.map((p) => p.productId)).toEqual([fx.cola.id])
    expect(data!.products[0]).toMatchObject({ boxes: 0, position: 0 })
  })

  test('a warehouse lists products stocked or priced there, plus the ones sold', async () => {
    const fx = await stocked()
    setToday('2026-11-30T18:00:00Z')
    const inB = (
      await getMonthlyResults(fx.owner, { month, warehouseId: fx.b.id })
    ).data!
    // B only has a price for the milk box piece; nothing is stocked there.
    expect(inB.products.map((p) => p.productId)).toEqual([fx.milkBox.id])
    const inA = (
      await getMonthlyResults(fx.owner, { month, warehouseId: fx.a.id })
    ).data!
    expect(inA.products.map((p) => p.productId)).toEqual([fx.milkBox.id])
  })
})

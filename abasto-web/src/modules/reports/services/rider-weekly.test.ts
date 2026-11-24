import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { db } from '#/db'
import { resetDatabase } from '#/db/testing'
import { updateProduct } from '#/modules/catalog/services/products'
import { createSupplier } from '#/modules/catalog/services/suppliers'
import { setPrices } from '#/modules/pricing/services/prices'
import {
  assignRider,
  settleAssignment,
} from '#/modules/riders/services/assignments'
import { createRider } from '#/modules/riders/services/riders'
import { getRiderWeeklyReport } from '#/modules/reports/services/rider-weekly'
import { getSalesReport } from '#/modules/reports/services/sales-report'
import {
  errorOf,
  receive,
  setupReports,
  useClock,
} from '#/modules/reports/services/testing'
import type { ReportsFixture } from '#/modules/reports/services/testing'
import type { RiderWeeklyCell } from '#/modules/reports/types/rider-weekly'

beforeEach(() => resetDatabase(db))
afterEach(() => useClock(null))

const at = (iso: string) => useClock(() => new Date(iso))
const forbidden = 'No tienes permiso para esta acción.'
const week = '2026-11-16'

/** Milk piece: sells 1000, costs 50, route pay 1200 per box of 12 = 100 per piece. */
async function stocked() {
  const fx = await setupReports()
  await receive(fx, {
    productId: fx.milkBox.id,
    quantity: 400,
    totalCostCents: 20_000,
  })
  await updateProduct(fx.owner, fx.milkBox.id, { routePayCents: 1200 })
  const luis = await createRider(fx.owner, {
    warehouseId: fx.a.id,
    name: 'Luis',
  })
  const ana = await createRider(fx.owner, { warehouseId: fx.a.id, name: 'Ana' })
  return { ...fx, luis, ana }
}

/** Hands out `units` pieces of milk and settles the same day at `settledAt`. */
async function deliver(
  fx: ReportsFixture & { luis: { id: string } },
  input: {
    riderId: string
    units: number
    back?: number
    scrap?: number
    settledAt: string
  },
) {
  at(input.settledAt)
  const assignment = await assignRider(fx.staffA, {
    riderId: input.riderId,
    lines: [{ productId: fx.milkBox.id, boxes: 0, units: input.units }],
  })
  const sold = input.units - (input.back ?? 0) - (input.scrap ?? 0)
  return settleAssignment(fx.staffA, {
    assignmentId: assignment.id,
    deliveredCents: sold * 1000,
    lines: [
      {
        lineId: assignment.lines[0].id,
        boxes: 0,
        units: input.back ?? 0,
        scrap: input.scrap,
      },
    ],
  })
}

describe('rider weekly report', () => {
  test('sums per rider, day and product, and splits the profit', async () => {
    const fx = await stocked()
    await deliver(fx, {
      riderId: fx.luis.id,
      units: 24,
      back: 2,
      scrap: 1,
      settledAt: '2026-11-16T20:00:00Z',
    })
    await deliver(fx, {
      riderId: fx.ana.id,
      units: 12,
      settledAt: '2026-11-16T21:00:00Z',
    })
    await deliver(fx, {
      riderId: fx.luis.id,
      units: 12,
      settledAt: '2026-11-18T20:00:00Z',
    })
    at('2026-11-24T18:00:00Z')
    const { data } = await getRiderWeeklyReport(fx.owner, {
      weekStart: '2026-11-18', // any day snaps to its Monday
      warehouseId: fx.a.id,
    })
    expect(data!.weekStart).toBe(week)
    expect(data!.days).toHaveLength(7)
    expect(data!.riders.map((rider) => rider.name)).toEqual(['Ana', 'Luis'])
    expect(data!.products).toHaveLength(1)
    expect(data!.products[0]).toMatchObject({
      name: 'Leche entera 1L',
      boxFactor: 12,
      routePayPerBoxCents: 1200,
      pieceCents: 1000,
    })
    const cell = (day: string, rider: string) =>
      data!.cells.find((c) => c.day === day && c.riderId === rider)
    // Luis, Monday: 24 out, 2 back, 1 damaged → 21 sold.
    expect(cell('2026-11-16', fx.luis.id)).toMatchObject({
      units: 21,
      revenueCents: 21_000,
      costCents: 21 * 50,
      scrapUnits: 1,
      routePayCents: 21 * 100,
    })
    expect(cell('2026-11-16', fx.ana.id)).toMatchObject({
      units: 12,
      revenueCents: 12_000,
      routePayCents: 1200,
      scrapUnits: 0,
    })
    expect(cell('2026-11-18', fx.luis.id)?.units).toBe(12)
    expect(data!.cells).toHaveLength(3)
  })

  test('route pay is the value frozen on the delivery, not the current one', async () => {
    const fx = await stocked()
    at('2026-11-16T15:00:00Z')
    const assignment = await assignRider(fx.staffA, {
      riderId: fx.luis.id,
      lines: [{ productId: fx.milkBox.id, boxes: 0, units: 12 }],
    })
    await updateProduct(fx.owner, fx.milkBox.id, { routePayCents: 3000 })
    at('2026-11-16T20:00:00Z')
    await settleAssignment(fx.staffA, {
      assignmentId: assignment.id,
      deliveredCents: 12_000,
      lines: [{ lineId: assignment.lines[0].id, boxes: 0, units: 0 }],
    })
    at('2026-11-24T18:00:00Z')
    const { data } = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    expect(data!.cells[0].routePayCents).toBe(1200)
    expect(data!.products[0].routePayPerBoxCents).toBe(1200)
  })

  test('merma-only lines still show; pieces lost are neither units nor cost', async () => {
    const fx = await stocked()
    await deliver(fx, {
      riderId: fx.luis.id,
      units: 5,
      scrap: 5,
      settledAt: '2026-11-17T20:00:00Z',
    })
    at('2026-11-24T18:00:00Z')
    const { data } = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    expect(data!.cells).toEqual([
      {
        day: '2026-11-17',
        riderId: fx.luis.id,
        productId: fx.milkBox.id,
        units: 0,
        revenueCents: 0,
        costCents: 0,
        scrapUnits: 5,
        routePayCents: 0,
      },
    ])
  })

  test('venta and costo match the sales report of the same week for Reparto', async () => {
    const fx = await stocked()
    await deliver(fx, {
      riderId: fx.luis.id,
      units: 30,
      back: 3,
      scrap: 2,
      settledAt: '2026-11-19T20:00:00Z',
    })
    await deliver(fx, {
      riderId: fx.ana.id,
      units: 13,
      settledAt: '2026-11-20T20:00:00Z',
    })
    at('2026-11-24T18:00:00Z')
    const { data } = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    const sales = await getSalesReport(fx.owner, {
      period: { preset: 'custom', from: week, to: '2026-11-22' },
      warehouseIds: [fx.a.id],
    })
    const reparto = sales.byChannel.find((row) => row.name === 'Reparto')!
    const sum = (pick: (cell: RiderWeeklyCell) => number) =>
      data!.cells.reduce((total, cell) => total + pick(cell), 0)
    expect(sum((cell) => cell.revenueCents)).toBe(reparto.revenueCents)
    expect(sum((cell) => cell.costCents)).toBe(reparto.costCents)
    expect(sum((cell) => cell.units)).toBe(reparto.units)
  })

  test('Sunday 23:59 belongs to the week, Monday 00:00 to the next one', async () => {
    const fx = await stocked()
    // Mexico City is UTC−6 all year.
    await deliver(fx, {
      riderId: fx.luis.id,
      units: 6,
      settledAt: '2026-11-23T05:59:00Z', // Sunday 22, 23:59 local
    })
    await deliver(fx, {
      riderId: fx.ana.id,
      units: 4,
      settledAt: '2026-11-23T06:00:00Z', // Monday 23, 00:00 local
    })
    at('2026-11-24T18:00:00Z')
    const first = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    expect(first.data!.cells.map((c) => [c.day, c.units])).toEqual([
      ['2026-11-22', 6],
    ])
    const next = await getRiderWeeklyReport(fx.owner, {
      weekStart: '2026-11-23',
      warehouseId: fx.a.id,
    })
    expect(next.data!.cells.map((c) => [c.day, c.units])).toEqual([
      ['2026-11-23', 4],
    ])
  })

  test('supplier filter keeps only that supplier’s products; riders stay listed', async () => {
    const fx = await stocked()
    await setPrices(fx.owner, {
      warehouseId: fx.a.id,
      prices: [{ presentationId: fx.box(fx.water).id, priceCents: 44_000 }],
    })
    await receive(fx, { productId: fx.water.id, quantity: 100 })
    at('2026-11-17T15:00:00Z')
    const assignment = await assignRider(fx.staffA, {
      riderId: fx.luis.id,
      lines: [
        { productId: fx.milkBox.id, boxes: 0, units: 10 },
        { productId: fx.water.id, boxes: 1, units: 0 },
      ],
    })
    await settleAssignment(fx.staffA, {
      assignmentId: assignment.id,
      deliveredCents: 0,
      lines: assignment.lines.map((line) => ({
        lineId: line.id,
        boxes: 0,
        units: 0,
      })),
    })
    at('2026-11-24T18:00:00Z')
    const all = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    // No supplier is named "lala": every supplier.
    expect(all.supplierId).toBeNull()
    expect(all.data!.products.map((p) => p.name)).toEqual([
      'Agua 1L',
      'Leche entera 1L',
    ])
    const alpura = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
      supplierId: fx.supplier.id,
    })
    expect(alpura.data!.products.map((p) => p.name)).toEqual([
      'Leche entera 1L',
    ])
    expect(alpura.data!.riders.map((r) => r.name)).toEqual(['Ana', 'Luis'])
  })

  test('the supplier named like lala is the default; "todos" overrides it', async () => {
    const fx = await stocked()
    const lala = await createSupplier(fx.owner, { name: 'Grupo LALA' })
    at('2026-11-24T18:00:00Z')
    const byDefault = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
    })
    expect(byDefault.supplierId).toBe(lala.id)
    expect(byDefault.data!.supplier?.name).toBe('Grupo LALA')
    const everyone = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.a.id,
      supplierId: 'todos',
    })
    expect(everyone.supplierId).toBeNull()
  })

  test('warehouse defaults to the first one managed; managers stay in theirs', async () => {
    const fx = await stocked()
    at('2026-11-24T18:00:00Z')
    const mine = await getRiderWeeklyReport(fx.managerA, { weekStart: week })
    expect(mine.warehouseId).toBe(fx.a.id)
    expect(mine.warehouses.map((item) => item.id)).toEqual([fx.a.id])
    expect(
      await errorOf(() =>
        getRiderWeeklyReport(fx.managerA, {
          weekStart: week,
          warehouseId: fx.b.id,
        }),
      ),
    ).toMatchObject({ code: 'forbidden', message: forbidden })
    const owner = await getRiderWeeklyReport(fx.owner, {
      weekStart: week,
      warehouseId: fx.b.id,
    })
    expect(owner.data!.warehouse.id).toBe(fx.b.id)
    expect(owner.data!.cells).toEqual([])
  })

  test('refuses a future or malformed week', async () => {
    const fx = await stocked()
    at('2026-11-24T18:00:00Z')
    expect(
      await errorOf(() =>
        getRiderWeeklyReport(fx.owner, { weekStart: '2026-11-30' }),
      ),
    ).toMatchObject({
      code: 'invalid',
      message: 'Elige una semana que no sea futura.',
    })
    expect(
      await errorOf(() =>
        getRiderWeeklyReport(fx.owner, { weekStart: 'ayer' }),
      ),
    ).toMatchObject({ code: 'invalid', message: 'Elige una semana válida.' })
  })
})

import { describe, expect, test } from 'bun:test'
import {
  buildWeeklySheet,
  buildWeeklySheets,
  weeklyFilename,
} from '#/modules/reports/lib/rider-weekly-sheet'
import type { RiderWeeklyReport } from '#/modules/reports/types/rider-weekly'

const report: RiderWeeklyReport = {
  weekStart: '2026-11-16',
  days: [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
  ],
  warehouse: { id: 'w', name: 'Tejupilco' },
  supplier: { id: 's', name: 'Lala', active: true },
  riders: [
    { id: 'r1', name: 'Luis' },
    { id: 'r2', name: 'Marta' },
  ],
  products: [
    {
      productId: 'p1',
      sku: 'L1',
      name: 'Leche entera',
      boxFactor: 12,
      routePayPerBoxCents: 1200,
      pieceCents: 2000,
    },
    {
      productId: 'p2',
      sku: 'L2',
      name: 'Crema',
      boxFactor: 6,
      routePayPerBoxCents: 0,
      pieceCents: 3000,
    },
  ],
  cells: [
    {
      day: '2026-11-16',
      riderId: 'r1',
      productId: 'p1',
      units: 12,
      revenueCents: 24000,
      costCents: 18000,
      scrapUnits: 1,
      routePayCents: 1200,
    },
    {
      day: '2026-11-16',
      riderId: 'r2',
      productId: 'p1',
      units: 6,
      revenueCents: 12000,
      costCents: 9000,
      scrapUnits: 0,
      routePayCents: 600,
    },
    {
      day: '2026-11-18',
      riderId: 'r1',
      productId: 'p2',
      units: 2,
      revenueCents: 6000,
      costCents: 4000,
      scrapUnits: 2,
      routePayCents: 0,
    },
  ],
}

describe('weekly sheet model', () => {
  test('one sheet per day plus the weekly one, named like the client’s workbook', () => {
    const sheets = buildWeeklySheets(report)
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      '16 NOV',
      '17 NOV',
      '18 NOV',
      '19 NOV',
      '20 NOV',
      '21 NOV',
      '22 NOV',
      'SEMANAL',
    ])
    expect(sheets[0].title).toBe('RUTAS LALA TEJUPILCO')
    expect(sheets[0].riders.map((rider) => rider.label)).toEqual([
      'RUTA 1 / LUIS',
      'RUTA 2 / MARTA',
    ])
  })

  test('a day splits venta − costo − pago ruta into depósito and ruta profit', () => {
    const sheet = buildWeeklySheet(report, '2026-11-16')
    const milk = sheet.rows[0]
    expect(milk.byRider[0]).toEqual({
      units: 12,
      revenueCents: 24000,
      depotProfitCents: 24000 - 18000 - 1200,
      routeProfitCents: 1200,
      scrapUnits: 1,
    })
    expect(milk).toMatchObject({
      sku: 'L1',
      boxFactor: 12,
      routePayPerBoxCents: 1200,
      pieceCents: 2000,
      totalUnits: 18,
      scrapUnits: 1,
      depotProfitCents: 4800 + 2400,
      routeProfitCents: 1800,
      totalProfitCents: 9000,
    })
    expect(sheet.rows[1].totalUnits).toBe(0)
    expect(sheet.totals.totalUnits).toBe(18)
    expect(sheet.totals.byRider[1].units).toBe(6)
  })

  test('the weekly sheet adds every day', () => {
    const week = buildWeeklySheet(report, null)
    expect(week.name).toBe('SEMANAL')
    expect(week.totals).toMatchObject({
      totalUnits: 20,
      scrapUnits: 3,
      depotProfitCents: 4800 + 2400 + 2000,
      routeProfitCents: 1800,
      totalProfitCents: 9000 + 2000,
    })
    expect(week.rows[1].byRider[0].units).toBe(2)
  })

  test('an empty day keeps every product and rider with zeros', () => {
    const sheet = buildWeeklySheet(report, '2026-11-22')
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.totals.totalProfitCents).toBe(0)
    expect(sheet.totals.byRider).toHaveLength(2)
  })

  test('file name carries the Monday', () => {
    expect(weeklyFilename('2026-11-16')).toBe('repartos-semana-2026-11-16.xlsx')
  })

  test('without supplier the title is only the warehouse', () => {
    expect(buildWeeklySheet({ ...report, supplier: null }, null).title).toBe(
      'RUTAS TEJUPILCO',
    )
  })
})

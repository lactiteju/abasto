import { describe, expect, test } from 'bun:test'
import ExcelJS from 'exceljs'
import { buildRiderWeeklyXlsx } from '#/modules/reports/lib/rider-weekly-xlsx'
import type { RiderWeeklyReport } from '#/modules/reports/types/rider-weekly'

const days = [
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
]
const report: RiderWeeklyReport = {
  weekStart: '2026-11-16',
  days,
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
const meta = {
  business: 'Abasto',
  scope: 'Tejupilco',
  generatedAt: '24 nov 2026, 10:30',
  generatedBy: 'Dueño',
}

async function read() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await buildRiderWeeklyXlsx(report, meta))
  return workbook
}

describe('repartos workbook', () => {
  test('one sheet per day plus SEMANAL with the client’s title and headers', async () => {
    const workbook = await read()
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '16 NOV',
      '17 NOV',
      '18 NOV',
      '19 NOV',
      '20 NOV',
      '21 NOV',
      '22 NOV',
      'SEMANAL',
    ])
    const sheet = workbook.getWorksheet('16 NOV')!
    expect(sheet.getCell('A1').value).toBe('RUTAS LALA TEJUPILCO')
    const top = sheet.getRow(4).values as Array<unknown>
    const sub = sheet.getRow(5).values as Array<unknown>
    expect([top[1], top[2], top[3], top[4], top[5]]).toEqual([
      'SKU',
      'PZ X CAJA',
      'PRODUCTO',
      'PAGO RUTA X CAJA',
      'PRECIO X PZ',
    ])
    expect(top[6]).toBe('RUTA 1 / LUIS')
    expect(top[10]).toBe('RUTA 2 / MARTA')
    expect(sub.slice(6, 10)).toEqual([
      'PZ VENDIDAS',
      'VENTA',
      'GANANCIA DEPÓSITO',
      'GANANCIA RUTA',
    ])
    expect(top.slice(14, 19)).toEqual([
      'TOTAL PZ',
      'PZ MERMA',
      'GANANCIA TOTAL DEPÓSITO',
      'GANANCIA TOTAL RUTA',
      'GANANCIA TOTAL',
    ])
  })

  test('product rows hold pesos and the totals row closes the sheet', async () => {
    const sheet = (await read()).getWorksheet('16 NOV')!
    const milk = sheet.getRow(6).values as Array<unknown>
    expect(milk.slice(1, 6)).toEqual(['L1', 12, 'Leche entera', 12, 20])
    // Luis: 12 pz, venta 240, depósito 240 − 180 − 12, ruta 12.
    expect(milk.slice(6, 10)).toEqual([12, 240, 48, 12])
    expect(milk.slice(10, 14)).toEqual([6, 120, 24, 6])
    expect(milk.slice(14, 19)).toEqual([18, 1, 72, 18, 90])
    expect(sheet.getCell(6, 7).numFmt).toBe('$ #,##0.00')
    const total = sheet.getRow(8).values as Array<unknown>
    expect(total[3]).toBe('TOTAL')
    expect(total.slice(14, 19)).toEqual([18, 1, 72, 18, 90])
  })

  test('the weekly sheet adds the days', async () => {
    const sheet = (await read()).getWorksheet('SEMANAL')!
    expect(sheet.getCell('A2').value).toBe('Semana del 16 al 22 de noviembre')
    const total = sheet.getRow(8).values as Array<unknown>
    expect(total.slice(14, 19)).toEqual([20, 3, 92, 18, 110])
    const crema = sheet.getRow(7).values as Array<unknown>
    expect(crema.slice(6, 10)).toEqual([2, 60, 20, 0])
  })

  test('header and the product columns stay frozen', async () => {
    const sheet = (await read()).getWorksheet('SEMANAL')!
    expect(sheet.views[0]).toMatchObject({
      state: 'frozen',
      xSplit: 3,
      ySplit: 5,
    })
    expect(sheet.getColumn(3).width).toBeGreaterThanOrEqual(30)
  })
})

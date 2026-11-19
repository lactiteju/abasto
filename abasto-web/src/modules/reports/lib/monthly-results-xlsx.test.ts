import { describe, expect, test } from 'bun:test'
import ExcelJS from 'exceljs'
import { buildMonthlyResultsXlsx } from '#/modules/reports/lib/monthly-results-xlsx'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

const zero = { orders: 0, revenueCents: 0, costCents: 0, marginCents: 0 }
const results: MonthlyResults = {
  month: '2026-11',
  range: { from: '2026-11-01', to: '2026-11-30' },
  through: '2026-11-03',
  days: ['2026-11-02', '2026-11-03', '2026-11-04'],
  byDay: [
    {
      day: '2026-11-02',
      orders: 2,
      revenueCents: 20892570,
      costCents: 15000000,
      marginCents: 5892570,
      boxes: 10,
    },
    { day: '2026-11-03', ...zero, boxes: 0 },
    { day: '2026-11-04', ...zero, boxes: 0 },
  ],
  products: [
    {
      productId: 'p1',
      name: 'Leche',
      sku: 'L1',
      boxName: 'Caja 12',
      boxFactor: 12,
      boxesByDay: { '2026-11-02': 10 },
      boxes: 10,
      revenueCents: 20892570,
      costCents: 15000000,
      marginCents: 5892570,
      marginPerBoxCents: 589257,
    },
  ],
  totals: { ...zero, boxes: 10, marginCents: 5892570, revenueCents: 20892570 },
  previous: { ...zero, boxes: 0 },
}

describe('buildMonthlyResultsXlsx', () => {
  test('writes both sheets with titles, headers, totals and "—" for future days', async () => {
    const buffer = await buildMonthlyResultsXlsx(results, {
      business: 'Abasto',
      scope: 'Todos los almacenes',
      generatedAt: '2026-11-19 10:30',
      generatedBy: 'Ana',
    })
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(buffer)
    expect(book.worksheets.map((s) => s.name)).toEqual([
      'Venta y ganancia por día',
      'Cajas por producto',
    ])

    const daily = book.getWorksheet('Venta y ganancia por día')!
    expect(daily.getCell('A1').value).toBe('Abasto')
    expect(daily.getCell('A2').value).toBe('Resultados de noviembre 2026')
    expect(daily.getCell('A3').value).toBe('Todos los almacenes')
    expect(daily.getCell('A5').value).toBe('FECHA')
    expect(daily.getCell('C5').value).toBe('GANANCIA DIARIA')
    expect(daily.getCell('A5').fill).toMatchObject({
      fgColor: { argb: 'FF5B2A86' },
    })
    expect(daily.getCell('A6').value).toBe('lunes, 2 de noviembre de 2026')
    expect(daily.getCell('B6').value).toBe(208925.7)
    expect(daily.getCell('B6').numFmt).toBe('$ #,##0.00')
    expect(daily.getCell('B8').value).toBe('—')
    expect(daily.getCell('A9').value).toBe('Semana 1 · 02 al 04 nov')
    expect(daily.getCell('A10').value).toBe('Total de ganancia')
    expect(daily.getCell('C10').value).toBe(58925.7)
    expect(daily.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 })

    const boxes = book.getWorksheet('Cajas por producto')!
    expect(boxes.getCell('A5').value).toBe('PRODUCTO')
    expect(boxes.getCell('B5').value).toBe('02')
    expect(boxes.getCell('E5').value).toBe('TOTAL CAJAS')
    expect(boxes.getCell('G5').value).toBe('GANANCIA')
    expect(boxes.getCell('A6').value).toBe('Leche')
    expect(boxes.getCell('B6').value).toBe(10)
    expect(boxes.getCell('D6').value).toBe('—')
    expect(boxes.getCell('G6').value).toBe(58925.7)
    expect(boxes.getCell('A7').value).toBe('Total cajas vendidas')
    expect(boxes.getCell('E7').value).toBe(10)
    expect(boxes.getCell('A8').value).toBe('Total de ganancia')
    expect(boxes.getCell('G8').value).toBe(58925.7)
    expect(boxes.views[0]).toMatchObject({ xSplit: 1, ySplit: 5 })
  })
})

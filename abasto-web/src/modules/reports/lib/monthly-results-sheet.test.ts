import { describe, expect, test } from 'bun:test'
import {
  buildBoxesSheet,
  buildDailySheet,
  dayHeader,
  longDateLabel,
  moneyLabel,
  monthTitle,
  weekLabel,
} from '#/modules/reports/lib/monthly-results-sheet'
import type {
  MonthlyDay,
  MonthlyProductRow,
  MonthlyResults,
} from '#/modules/reports/types/monthly-results'

const day = (
  date: string,
  revenueCents = 0,
  marginCents = 0,
  boxes = 0,
): MonthlyDay => ({
  day: date,
  orders: revenueCents ? 1 : 0,
  revenueCents,
  costCents: revenueCents - marginCents,
  marginCents,
  boxes,
})

const product = (
  name: string,
  boxesByDay: Record<string, number>,
  marginCents: number,
  position: number,
): MonthlyProductRow => {
  const boxes = Object.values(boxesByDay).reduce((a, b) => a + b, 0)
  return {
    productId: name,
    name,
    sku: name,
    position,
    boxName: 'Caja 12',
    boxFactor: 12,
    boxesByDay,
    boxes,
    revenueCents: marginCents * 2,
    costCents: marginCents,
    marginCents,
    marginPerBoxCents: boxes ? Math.round(marginCents / boxes) : null,
  }
}

// Nov 2026: Mon 2 .. Sat 7, Mon 9 .. Sat 14 (+ Sun 8 with sales). Today = 9.
const days = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
]
const byDay = [
  day('2026-11-02', 20892570, 5000000, 10),
  day('2026-11-03', 10000000, 2000000, 4),
  day('2026-11-04'),
  day('2026-11-05', 5000, 1000),
  day('2026-11-06'),
  day('2026-11-07', 100, 50),
  day('2026-11-08', 300, 100),
  day('2026-11-09', 200, 100, 2.5),
  day('2026-11-10'),
  day('2026-11-11'),
]
const results: MonthlyResults = {
  month: '2026-11',
  range: { from: '2026-11-01', to: '2026-11-30' },
  through: '2026-11-09',
  days,
  byDay,
  products: [
    product('Leche', { '2026-11-02': 10, '2026-11-09': 2.5 }, 6000000, 2),
    product('Queso', { '2026-11-03': 4 }, 1000000, 1),
    product('Sin ventas', {}, 0, 0),
  ],
  totals: {
    orders: 5,
    revenueCents: byDay.reduce((s, d) => s + d.revenueCents, 0),
    costCents: 0,
    marginCents: byDay.reduce((s, d) => s + d.marginCents, 0),
    boxes: 16.5,
  },
  previous: {
    orders: 0,
    revenueCents: 0,
    costCents: 0,
    marginCents: 0,
    boxes: 0,
  },
}

describe('labels', () => {
  test('long date uses the plain calendar day, no timezone shift', () => {
    expect(longDateLabel('2026-11-02')).toBe('lunes, 2 de noviembre de 2026')
    expect(longDateLabel('2026-12-31')).toBe('jueves, 31 de diciembre de 2026')
  })

  test('money as "$ 208,925.70"', () => {
    expect(moneyLabel(20892570)).toBe('$ 208,925.70')
    expect(moneyLabel(0)).toBe('$ 0.00')
    expect(moneyLabel(-1005)).toBe('-$ 10.05')
  })

  test('day header is the two-digit day of month', () => {
    expect(dayHeader('2026-11-02')).toBe('02')
    expect(dayHeader('2026-11-14')).toBe('14')
  })

  test('month title and week labels', () => {
    expect(monthTitle('2026-11')).toBe('Resultados de noviembre 2026')
    expect(weekLabel(1, '2026-11-02', '2026-11-07')).toBe(
      'Semana 1 · 02 al 07 nov',
    )
    expect(weekLabel(2, '2026-11-09', '2026-11-09')).toBe('Semana 2 · 09 nov')
  })
})

describe('buildDailySheet', () => {
  const sheet = buildDailySheet(results)

  test('groups days into Sunday-to-Saturday weeks, like the client calendar', () => {
    const weeks = sheet.rows.filter((r) => r.kind === 'week')
    expect(weeks.map((w) => w.label)).toEqual([
      'Semana 1 · 02 al 07 nov',
      'Semana 2 · 08 al 11 nov',
    ])
    expect(sheet.rows.map((r) => r.kind)).toEqual([
      ...Array<'day' | 'week'>(6).fill('day'),
      'week',
      ...Array<'day' | 'week'>(4).fill('day'),
      'week',
    ])
  })

  test('a Sunday on the 1st opens the first week instead of standing alone', () => {
    const sheetOf = buildDailySheet({
      ...results,
      days: ['2026-11-01', ...days],
      byDay: [day('2026-11-01', 400, 200), ...byDay],
    })
    const weeks = sheetOf.rows.filter((r) => r.kind === 'week')
    expect(weeks[0].label).toBe('Semana 1 · 01 al 07 nov')
    expect(weeks).toHaveLength(2)
  })

  test('week and month totals equal the sums of the days', () => {
    const [w1, w2] = sheet.rows.filter((r) => r.kind === 'week')
    expect(w1.revenueCents).toBe(20892570 + 10000000 + 5000 + 100)
    expect(w1.marginCents).toBe(5000000 + 2000000 + 1000 + 50)
    expect(w2.revenueCents).toBe(300 + 200)
    expect(sheet.total.revenueCents).toBe(w1.revenueCents! + w2.revenueCents!)
    expect(sheet.total.marginCents).toBe(w1.marginCents! + w2.marginCents!)
    expect(sheet.total.label).toBe('Total de ganancia')
  })

  test('days after `through` are empty, past days without sales are 0', () => {
    const rows = sheet.rows.filter((r) => r.kind === 'day')
    expect(rows[2].empty).toBe(false)
    expect(rows[2].revenueCents).toBe(0)
    expect(rows[8].empty).toBe(true)
    expect(rows[8].revenueCents).toBeNull()
    expect(rows[9].empty).toBe(true)
    expect(rows[0].label).toBe('lunes, 2 de noviembre de 2026')
  })

  test('a week whose days are all after `through` has an empty subtotal', () => {
    const early = buildDailySheet({
      ...results,
      through: '2026-11-07',
    })
    const [w1, w2] = early.rows.filter((r) => r.kind === 'week')
    expect(w1.empty).toBe(false)
    expect(w1.revenueCents).toBe(20892570 + 10000000 + 5000 + 100)
    expect(w2.empty).toBe(true)
    expect(w2.revenueCents).toBeNull()
    expect(w2.marginCents).toBeNull()
    expect(early.total.revenueCents).toBe(w1.revenueCents!)
  })

  test('Sundays appear only when present in days', () => {
    const rows = sheet.rows.filter((r) => r.kind === 'day')
    expect(rows.some((r) => r.day === '2026-11-08')).toBe(true)
    expect(rows.some((r) => r.day === '2026-11-15')).toBe(false)
  })
})

describe('buildDailySheet boxes and quiet days', () => {
  const sheet = buildDailySheet(results)
  const dayRow = (date: string) => sheet.rows.find((r) => r.day === date)!

  test('columns end with CAJAS; days carry their boxes', () => {
    expect(sheet.columns).toEqual([
      'FECHA',
      'VENTA DIARIA',
      'GANANCIA DIARIA',
      'CAJAS',
    ])
    expect(dayRow('2026-11-02').boxes).toBe(10)
    expect(dayRow('2026-11-10').boxes).toBeNull()
  })

  test('past days without sales are quiet; sold and future days are not', () => {
    expect(dayRow('2026-11-04').quiet).toBe(true)
    expect(dayRow('2026-11-02').quiet).toBe(false)
    expect(dayRow('2026-11-10').quiet).toBe(false)
    expect(dayRow('2026-11-10').empty).toBe(true)
  })

  test('week subtotals and month total add the boxes', () => {
    const [w1, w2] = sheet.rows.filter((r) => r.kind === 'week')
    expect(w1.boxes).toBe(14)
    expect(w2.boxes).toBe(2.5)
    expect(sheet.total.boxes).toBe(16.5)
  })
})

describe('buildBoxesSheet', () => {
  const sheet = buildBoxesSheet(results)
  const rowOf = (name: string) => sheet.rows.find((r) => r.name === name)!

  test('rows follow the catalog order and list unsold products', () => {
    expect(sheet.rows.map((r) => r.name)).toEqual([
      'Sin ventas',
      'Queso',
      'Leche',
    ])
    expect(rowOf('Sin ventas')).toMatchObject({ boxes: 0, boxName: 'Caja 12' })
    const sold = buildBoxesSheet(results, { unsold: false })
    expect(sold.rows.map((r) => r.name)).toEqual(['Queso', 'Leche'])
    expect(sold.totalBoxes).toBe(sheet.totalBoxes)
  })

  test('two-digit day headers, one column per day', () => {
    expect(sheet.dayHeaders).toEqual([
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
    ])
    expect(sheet.dayHeaders).toHaveLength(results.days.length)
  })

  test('future days are marked, past days keep boxes or null', () => {
    expect(sheet.futureDays).toEqual([
      ...Array<boolean>(8).fill(false),
      true,
      true,
    ])
    const leche = rowOf('Leche')
    expect(leche.boxesByDay[0]).toBe(10)
    expect(leche.boxesByDay[1]).toBeNull()
    expect(leche.boxesByDay[7]).toBe(2.5)
  })

  test('product rows carry totals and per-box margin', () => {
    expect(rowOf('Leche').boxes).toBe(12.5)
    expect(rowOf('Leche').marginPerBoxCents).toBe(480000)
    expect(rowOf('Sin ventas').marginPerBoxCents).toBeNull()
  })

  test('totals are the sums of the rows and match the daily sheet', () => {
    expect(sheet.totalBoxes).toBe(16.5)
    expect(sheet.totalMarginCents).toBe(7000000)
    expect(sheet.dayTotals[0]).toBe(10)
    expect(sheet.dayTotals[1]).toBe(4)
    const products = sheet.rows.reduce((s, r) => s + r.marginCents, 0)
    expect(sheet.totalMarginCents).toBe(products)
  })
})

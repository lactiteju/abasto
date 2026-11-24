import { describe, expect, test } from 'bun:test'
import {
  dayChipLabel,
  daySheetName,
  defaultSupplier,
  routePayCents,
  shiftWeek,
  weekDays,
  weekHeading,
  weekOf,
  weekStartOf,
} from '#/modules/reports/lib/rider-weekly-week'

describe('week range', () => {
  test('the week starts on Monday, Sunday included', () => {
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16') // Monday
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16') // Sunday
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23') // next Monday
    expect(weekStartOf('2026-11-24')).toBe('2026-11-23')
  })

  test('seven days Monday to Sunday across a month change', () => {
    expect(weekDays('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ])
  })

  test('shifts by whole weeks', () => {
    expect(shiftWeek('2026-11-16', -1)).toBe('2026-11-09')
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04')
  })

  test('the URL week snaps to its Monday; junk falls back to the current week', () => {
    expect(weekOf('2026-11-18', '2026-11-24')).toBe('2026-11-16')
    expect(weekOf(undefined, '2026-11-24')).toBe('2026-11-23')
    expect(weekOf('2026-13-40', '2026-11-24')).toBe('2026-11-23')
  })
})

describe('labels', () => {
  test('week heading, in one month and across two', () => {
    expect(weekHeading('2026-11-16')).toBe('Semana del 16 al 22 de noviembre')
    expect(weekHeading('2026-11-30')).toBe(
      'Semana del 30 de noviembre al 6 de diciembre',
    )
  })

  test('sheet and chip names', () => {
    expect(daySheetName('2026-11-16')).toBe('16 NOV')
    expect(daySheetName('2026-12-01')).toBe('1 DIC')
    expect(dayChipLabel('2026-11-16')).toBe('Lun 16')
    expect(dayChipLabel('2026-11-22')).toBe('Dom 22')
  })
})

describe('route pay proration', () => {
  test('whole boxes pay the full amount, pieces a share, half-up', () => {
    expect(routePayCents(12, 1200, 12)).toBe(1200)
    expect(routePayCents(6, 1200, 12)).toBe(600)
    expect(routePayCents(1, 1000, 12)).toBe(83) // 83.33
    expect(routePayCents(1, 1050, 12)).toBe(88) // 87.5 → 88
    expect(routePayCents(0, 1200, 12)).toBe(0)
    expect(routePayCents(5, 0, 12)).toBe(0)
  })
})

describe('default supplier', () => {
  test('first supplier named like lala, else none', () => {
    const list = [
      { id: 'a', name: 'Bimbo', active: true },
      { id: 'b', name: 'Grupo LALA', active: true },
    ]
    expect(defaultSupplier(list)?.id).toBe('b')
    expect(defaultSupplier(list.slice(0, 1))).toBeNull()
  })
})

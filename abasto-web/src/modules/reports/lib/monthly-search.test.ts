import { describe, expect, test } from 'bun:test'
import {
  monthOf,
  parseMonthlySearch,
  shiftMonth,
} from '#/modules/reports/lib/monthly-search'

describe('monthly search params', () => {
  test('absent and junk values stay out of the URL', () => {
    expect(parseMonthlySearch({})).toEqual({})
    expect(parseMonthlySearch({ vista: 'tablero', mes: '2026-13' })).toEqual({})
    expect(parseMonthlySearch({ vista: 1, mes: 202611 })).toEqual({})
    expect(parseMonthlySearch({ mes: '2026-1' })).toEqual({})
  })

  test('keeps the results view and a well-formed month', () => {
    expect(parseMonthlySearch({ vista: 'resultados', mes: '2026-10' })).toEqual(
      { vista: 'resultados', mes: '2026-10' },
    )
    expect(parseMonthlySearch({ vista: 'resultados' })).toEqual({
      vista: 'resultados',
    })
  })

  test('the month defaults to the current one', () => {
    expect(monthOf({}, '2026-11-19')).toBe('2026-11')
    expect(monthOf({ mes: '2026-09' }, '2026-11-19')).toBe('2026-09')
  })

  test('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-11', -1)).toBe('2026-10')
  })
})

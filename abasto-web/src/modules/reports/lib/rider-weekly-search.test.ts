import { describe, expect, test } from 'bun:test'
import { parseRiderWeeklySearch } from '#/modules/reports/lib/rider-weekly-search'

describe('repartos search params', () => {
  test('junk stays out of the URL', () => {
    expect(parseRiderWeeklySearch({})).toEqual({})
    expect(parseRiderWeeklySearch({ semana: 'hoy' })).toEqual({})
    expect(parseRiderWeeklySearch({ semana: '2026-02-30' })).toEqual({})
    expect(parseRiderWeeklySearch({ semana: 20261116 })).toEqual({})
  })

  test('any date snaps to its Monday', () => {
    expect(parseRiderWeeklySearch({ semana: '2026-11-16' })).toEqual({
      semana: '2026-11-16',
    })
    expect(parseRiderWeeklySearch({ semana: '2026-11-22' })).toEqual({
      semana: '2026-11-16',
    })
  })
})

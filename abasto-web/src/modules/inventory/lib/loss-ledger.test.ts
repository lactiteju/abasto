import { describe, expect, test } from 'bun:test'
import {
  filterLosses,
  freePieces,
  lossCostCents,
  lossMotive,
  lossPeriodStart,
  lossTotals,
} from '#/modules/inventory/lib/loss-ledger'
import type { LossRow } from '#/modules/inventory/lib/loss-ledger'

describe('freePieces', () => {
  test('leaves out order holds and rider units', () => {
    expect(freePieces({ onHand: 20, reserved: 5, inRoute: 3 })).toBe(12)
    expect(freePieces({ onHand: 4, reserved: 4, inRoute: 2 })).toBe(0)
  })
})

describe('lossMotive', () => {
  test('category with and without a note', () => {
    expect(lossMotive('dañado')).toEqual({
      kind: 'dañado',
      label: 'Dañado',
      detail: '',
    })
    expect(lossMotive('caducado: se mojó')).toEqual({
      kind: 'caducado',
      label: 'Caducado',
      detail: 'se mojó',
    })
  })
  test('rider settlement keeps the rider as the label', () => {
    expect(lossMotive('dañado: Reparto Luis')).toEqual({
      kind: 'reparto',
      label: 'Reparto Luis',
      detail: 'Dañado',
    })
  })
  test('other reasons show their own text', () => {
    expect(lossMotive('otro: robo en bodega').label).toBe('robo en bodega')
    expect(lossMotive('otro: robo en bodega').kind).toBe('otro')
    expect(lossMotive('algo raro').label).toBe('algo raro')
  })
})

describe('lossCostCents', () => {
  test('prorates the lot cost over its received pieces', () => {
    expect(lossCostCents(3, 10, 5000)).toBe(1500)
    expect(lossCostCents(1, 3, 100)).toBe(33)
  })
})

describe('lossPeriodStart', () => {
  test('week starts on Monday, month on the 1st, all is open', () => {
    expect(lossPeriodStart('week', '2026-11-24')).toBe('2026-11-23')
    expect(lossPeriodStart('week', '2026-11-22')).toBe('2026-11-16')
    expect(lossPeriodStart('month', '2026-11-24')).toBe('2026-11-01')
    expect(lossPeriodStart('all', '2026-11-24')).toBeNull()
  })
})

const row = (over: Partial<LossRow>): LossRow => ({
  id: 'x',
  productName: 'Leche',
  sku: 'LEC-1',
  quantity: 2,
  reason: 'dañado',
  createdAt: '2026-11-24T18:00:00.000Z',
  costCents: 100,
  ...over,
})

describe('filterLosses', () => {
  const rows = [
    row({ id: 'a' }),
    row({ id: 'b', productName: 'Arroz', sku: 'ARR', reason: 'caducado' }),
    row({
      id: 'c',
      reason: 'dañado: Reparto Luis',
      createdAt: '2026-10-02T18:00:00.000Z',
    }),
  ]
  const base = { query: '', motive: 'Todos', period: 'all' as const }
  const ids = (found: Array<LossRow>) => found.map(({ id }) => id)

  test('search by name or sku, accent-insensitive', () => {
    expect(
      ids(filterLosses(rows, { ...base, query: 'arr' }, '2026-11-24')),
    ).toEqual(['b'])
    expect(
      ids(filterLosses(rows, { ...base, query: 'LECHE' }, '2026-11-24')),
    ).toEqual(['a', 'c'])
  })
  test('motive and period', () => {
    expect(
      ids(filterLosses(rows, { ...base, motive: 'reparto' }, '2026-11-24')),
    ).toEqual(['c'])
    expect(
      ids(filterLosses(rows, { ...base, period: 'month' }, '2026-11-24')),
    ).toEqual(['a', 'b'])
  })
})

describe('lossTotals', () => {
  test('sums pieces and the known costs', () => {
    expect(
      lossTotals([
        row({ quantity: 2, costCents: 100 }),
        row({ quantity: 3, costCents: null }),
      ]),
    ).toEqual({ pieces: 5, costCents: 100, hasCost: true })
    expect(lossTotals([row({ costCents: null })]).hasCost).toBe(false)
  })
})

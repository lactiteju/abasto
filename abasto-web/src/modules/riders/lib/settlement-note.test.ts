import { describe, expect, test } from 'bun:test'

import { priceSold } from '#/modules/riders/lib/allocation-pricing'
import { buildSettlementNote } from '#/modules/riders/lib/settlement-note'
import { formatCents } from '#/modules/pricing/lib/money'

const meta = { business: 'Abasto', warehouseName: 'Central' }

const allocation = (quantity: number, pieceCents: number | null = 150) => ({
  lotId: 'lot',
  quantity,
  priceCents: 1000,
  priceFactor: 12,
  pieceCents,
  leftoverQuantity: null,
  soldQuantity: null,
})

const line = (
  name: string,
  assigned: number,
  leftover: number,
  allocations = [allocation(assigned)],
) => ({
  id: name,
  productId: name,
  productName: name,
  boxFactor: 12,
  assignedQuantity: assigned,
  leftoverQuantity: leftover,
  soldQuantity: assigned - leftover,
  allocations,
})

const base = {
  id: '3f2a9c1e-aaaa-bbbb-cccc-000000000000',
  riderName: 'Beto',
  createdAt: new Date('2026-11-17T15:00:00Z'),
  closedAt: new Date('2026-11-18T18:00:00Z'),
}

describe('buildSettlementNote', () => {
  // Leche: 30 assigned, 3 back → 27 sold = 2 boxes ($20) + 3 pieces ($4.50).
  // Queso: 12 assigned, 0 back → 1 box ($10). Yogurt: all back → no row.
  const lines = [
    line('Leche', 30, 3),
    line('Queso', 12, 0),
    line('Yogurt', 12, 12),
  ]
  const expected = 2450 + 1000

  test('sold lines only: boxes and pieces at the frozen prices', () => {
    const note = buildSettlementNote(
      { ...base, expectedCents: expected, deliveredCents: expected, lines },
      meta,
    )
    expect(note.customer).toBe('Beto')
    expect(note.partyLabel).toBe('Repartidor')
    expect(note.folio).toBe('REP-3F2A9C1E')
    expect(note.filename).toBe('nota-REP-3F2A9C1E.pdf')
    expect(note.warehouse).toBe('Central')
    expect(note.rows).toEqual([
      ['2', 'Leche (caja de 12)', formatCents(1000), formatCents(2000)],
      ['3', 'Leche (pieza)', formatCents(150), formatCents(450)],
      ['1', 'Queso (caja de 12)', formatCents(1000), formatCents(1000)],
    ])
    expect(note.total).toBe(formatCents(expected))
    expect(note.extraTotals).toEqual([])
  })

  test('row importes add up to the expected amount the settlement used', () => {
    const note = buildSettlementNote(
      { ...base, expectedCents: expected, deliveredCents: expected, lines },
      meta,
    )
    const cents = lines.reduce(
      (sum, l) =>
        sum +
        priceSold(l.allocations, l.soldQuantity).reduce(
          (s, p) => s + p.cents,
          0,
        ),
      0,
    )
    expect(cents).toBe(expected)
    expect(note.rows.map((r) => r[3])).toEqual(
      ['$20.00', '$4.50', '$10.00'].map(String),
    )
  })

  test('shows Entregado and Faltante when the cash is short', () => {
    const note = buildSettlementNote(
      { ...base, expectedCents: expected, deliveredCents: 3000, lines },
      meta,
    )
    expect(note.extraTotals).toEqual([
      ['Entregado', formatCents(3000)],
      ['Faltante', formatCents(450)],
    ])
  })

  test('shows Sobrante when the rider handed in more', () => {
    const note = buildSettlementNote(
      { ...base, expectedCents: expected, deliveredCents: 3500, lines },
      meta,
    )
    expect(note.extraTotals).toEqual([
      ['Entregado', formatCents(3500)],
      ['Sobrante', formatCents(50)],
    ])
  })

  test('without a piece price, pieces are prorated from the box price', () => {
    const note = buildSettlementNote(
      {
        ...base,
        expectedCents: 1250,
        deliveredCents: 1250,
        lines: [line('Leche', 15, 0, [allocation(15, null)])],
      },
      meta,
    )
    expect(note.rows).toEqual([
      ['1', 'Leche (caja de 12)', formatCents(1000), formatCents(1000)],
      ['3', 'Leche (pieza)', formatCents(83), formatCents(250)],
    ])
  })
})

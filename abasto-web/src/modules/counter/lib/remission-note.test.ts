import { describe, expect, test } from 'bun:test'

import { buildRemissionNote } from '#/modules/counter/lib/remission-note'
import { formatCents } from '#/modules/pricing/lib/money'

const order = {
  id: '3f2a9c1e-aaaa-bbbb-cccc-000000000000',
  customerName: 'Abarrotes Lupita',
  totalCents: 35000,
  createdAt: new Date('2026-11-16T15:00:00Z'),
  closedAt: new Date('2026-11-17T18:00:00Z'),
  lines: [
    {
      productName: 'Arroz',
      presentationName: 'Caja 10 kg',
      quantity: 2,
      unitPriceCents: 10000,
      lineTotalCents: 20000,
    },
    {
      productName: 'Frijol',
      presentationName: 'Bulto',
      quantity: 3,
      unitPriceCents: 5000,
      lineTotalCents: 15000,
    },
  ],
} as unknown as Parameters<typeof buildRemissionNote>[0]

const meta = { business: 'Abasto', warehouseName: 'Central' }

describe('remission note', () => {
  const note = buildRemissionNote(order, meta)

  test('header carries folio, customer, warehouse and filename', () => {
    expect(note.title).toBe('NOTA DE REMISIÓN')
    expect(note.folio).toBe('PED-3F2A9C1E')
    expect(note.customer).toBe('Abarrotes Lupita')
    expect(note.warehouse).toBe('Central')
    expect(note.business).toBe('Abasto')
    expect(note.filename).toBe('nota-PED-3F2A9C1E.pdf')
    expect(note.date).toContain('17')
  })

  test('one row per line and the total', () => {
    expect(note.rows).toEqual([
      ['2', 'Arroz Caja 10 kg', formatCents(10000), formatCents(20000)],
      ['3', 'Frijol Bulto', formatCents(5000), formatCents(15000)],
    ])
    expect(note.total).toBe(formatCents(35000))
    expect(note.paidMark).toBe('PAGADO')
  })

  test('falls back to the creation date when not closed', () => {
    const open = buildRemissionNote({ ...order, closedAt: null }, meta)
    expect(open.date).toContain('16')
  })
})

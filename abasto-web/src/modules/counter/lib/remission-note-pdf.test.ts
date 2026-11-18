import { describe, expect, test } from 'bun:test'

import { renderRemissionNote } from '#/modules/counter/lib/remission-note-pdf'
import type { RemissionNote } from '#/modules/counter/lib/remission-note'

const noteWith = (lines: number): RemissionNote => ({
  business: 'Distribuidora del Sur',
  title: 'NOTA DE REMISIÓN',
  folio: 'PED-F464FB55',
  date: '18 de noviembre de 2026',
  customer: 'Albino',
  warehouse: 'Tejupilco',
  head: ['CANT.', 'ARTÍCULO', 'PRECIO', 'IMPORTE'],
  rows: Array.from({ length: lines }, (_, i) => [
    String(i + 1),
    `Alpura Vaquitas Fresa 180 ml Caja ${i}`,
    '$221.41',
    '$664.23',
  ]),
  totalLabel: 'TOTAL',
  total: '$2,214.10',
  paidMark: 'PAGADO',
  signature: 'Recibí de conformidad',
  filename: 'nota-PED-F464FB55.pdf',
})

const pageTexts = (doc: Awaited<ReturnType<typeof renderRemissionNote>>) =>
  Array.from({ length: doc.getNumberOfPages() }, (_, i) => {
    doc.setPage(i + 1)
    return doc.output()
  })

describe('remission note PDF', () => {
  test('a usual order prints original and copy on one letter sheet', async () => {
    const doc = await renderRemissionNote(noteWith(3))
    expect(doc.getNumberOfPages()).toBe(1)
    const pdf = doc.output()
    expect(pdf).toContain('Original')
    expect(pdf).toContain('Copia')
  })

  test('twelve lines still fit half a sheet', async () => {
    expect((await renderRemissionNote(noteWith(12))).getNumberOfPages()).toBe(1)
  })

  test('a long order falls back to one sheet per copy', async () => {
    const doc = await renderRemissionNote(noteWith(30))
    expect(doc.getNumberOfPages()).toBe(2)
    expect(pageTexts(doc)).toHaveLength(2)
  })

  test('prints the party label and the summary lines under the total', async () => {
    const doc = await renderRemissionNote({
      ...noteWith(2),
      partyLabel: 'Repartidor',
      extraTotals: [
        ['Entregado', '$100.00'],
        ['Faltante', '$5.00'],
      ],
    })
    const pdf = doc.output()
    expect(pdf).toContain('Repartidor')
    expect(pdf).toContain('Entregado')
    expect(pdf).toContain('Faltante')
    expect(doc.getNumberOfPages()).toBe(1)
  })

  test('Spanish text, long names and the stamp render without throwing', async () => {
    const doc = await renderRemissionNote({
      ...noteWith(0),
      customer: 'Niño Ñandú Peña',
      rows: [
        ['1', 'Leche Ñandú ' + 'deslactosada '.repeat(12), '$1.00', '$1.00'],
        ['2', 'Yogur día áéíóú ü', '$2.00', '$4.00'],
        ['3', 'Emoji 🥛 y “comillas” – raya', '$3.00', '$9.00'],
      ],
    })
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.output()).toContain('PAGADO')
  })
})

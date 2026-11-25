import { describe, expect, test } from 'bun:test'

import {
  openOnRowKey,
  orderRowMenuItems,
} from '#/modules/counter/lib/order-row-menu'

const base = {
  canReopen: false,
  pdfPending: false,
  reopenPending: false,
  onView: () => {},
  onPdf: () => {},
  onReopen: () => {},
}
const labels = (input: Parameters<typeof orderRowMenuItems>[0]) =>
  orderRowMenuItems(input).map((item) => item.label)

describe('orderRowMenuItems', () => {
  test('Reservado only offers Ver pedido', () => {
    expect(labels({ ...base, status: 'Reservado', canReopen: true })).toEqual([
      'Ver pedido',
    ])
  })

  test('Recogido adds Nota PDF for everyone', () => {
    expect(labels({ ...base, status: 'Recogido' })).toEqual([
      'Ver pedido',
      'Nota PDF',
    ])
  })

  test('owner on Recogido also gets Editar venta, destructive', () => {
    const items = orderRowMenuItems({
      ...base,
      status: 'Recogido',
      canReopen: true,
    })
    expect(items.map((item) => item.label)).toEqual([
      'Ver pedido',
      'Nota PDF',
      'Editar venta',
    ])
    expect(items.map((item) => item.destructive)).toEqual([
      undefined,
      undefined,
      true,
    ])
  })

  test('Cancelado / Vencido offer only Ver pedido even for the owner', () => {
    for (const status of ['Cancelado', 'Vencido']) {
      expect(labels({ ...base, status, canReopen: true })).toEqual([
        'Ver pedido',
      ])
    }
  })

  test('shows progress and disables Nota PDF while generating', () => {
    const pdf = orderRowMenuItems({
      ...base,
      status: 'Recogido',
      pdfPending: true,
    })[1]
    expect(pdf.label).toBe('Generando…')
    expect(pdf.disabled).toBe(true)
  })

  test('items call their handlers', () => {
    const calls: string[] = []
    const items = orderRowMenuItems({
      ...base,
      status: 'Recogido',
      canReopen: true,
      onView: () => calls.push('view'),
      onPdf: () => calls.push('pdf'),
      onReopen: () => calls.push('reopen'),
    })
    for (const item of items) item.onSelect()
    expect(calls).toEqual(['view', 'pdf', 'reopen'])
  })
})

describe('openOnRowKey', () => {
  const row = {}
  function press(key: string, target: unknown = row) {
    let opened = 0
    let prevented = false
    openOnRowKey(() => opened++)({
      key,
      target,
      currentTarget: row,
      preventDefault: () => {
        prevented = true
      },
    })
    return { opened, prevented }
  }

  test('Enter and Space on the row open it', () => {
    expect(press('Enter')).toEqual({ opened: 1, prevented: true })
    expect(press(' ')).toEqual({ opened: 1, prevented: true })
  })

  test('other keys are ignored', () => {
    expect(press('Tab')).toEqual({ opened: 0, prevented: false })
  })

  test('keys from an inner control (the menu) are ignored', () => {
    expect(press('Enter', {})).toEqual({ opened: 0, prevented: false })
  })
})

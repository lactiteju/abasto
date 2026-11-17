import { describe, expect, test } from 'bun:test'

import {
  currentAssignments,
  differenceLabel,
  differenceTone,
  loadSummary,
  statusTone,
  whenLabel,
} from './assignment-view'

const at = (iso: string) => new Date(iso)

describe('currentAssignments', () => {
  const base = {
    riderName: 'Luis',
    closedAt: null,
  }
  const list = [
    {
      ...base,
      id: 'old-open',
      status: 'En ruta',
      createdAt: at('2026-11-01T15:00:00Z'),
    },
    {
      ...base,
      id: 'today-new',
      status: 'En ruta',
      createdAt: at('2026-11-08T15:00:00Z'),
    },
    {
      ...base,
      id: 'old-done',
      status: 'Liquidada',
      createdAt: at('2026-11-07T15:00:00Z'),
      closedAt: at('2026-11-08T03:00:00Z'),
    },
    {
      ...base,
      id: 'old-closed',
      status: 'Cancelada',
      createdAt: at('2026-11-06T15:00:00Z'),
      closedAt: at('2026-11-06T20:00:00Z'),
    },
  ] as const

  test('keeps every open assignment and what moved today (business day)', () => {
    // 2026-11-08 03:00Z is 21:00 of the 7th in Mexico City; "today" is the 8th.
    const ids = currentAssignments(list, '2026-11-08').map((a) => a.id)
    expect(ids).toEqual(['old-open', 'today-new'])
  })

  test('a settlement closed during the business day stays visible', () => {
    const ids = currentAssignments(list, '2026-11-07').map((a) => a.id)
    // Open ones always stay, however old or new.
    expect(ids).toEqual(['old-open', 'today-new', 'old-done'])
  })
})

describe('differenceLabel', () => {
  test('names shortage, surplus and exact', () => {
    expect(differenceLabel(0)).toBe('Sin diferencia')
    expect(differenceLabel(-1500)).toContain('Faltante')
    expect(differenceLabel(-1500)).toContain('15.00')
    expect(differenceLabel(250)).toContain('Sobrante')
    expect(differenceLabel(250)).toContain('2.50')
  })
})

describe('differenceTone', () => {
  test('shortage warns, surplus notes, exact is calm', () => {
    expect(differenceTone(-100)).toBe('shortage')
    expect(differenceTone(100)).toBe('surplus')
    expect(differenceTone(0)).toBe('exact')
  })
})

describe('loadSummary', () => {
  const line = (productName: string, assignedQuantity: number) => ({
    productName,
    assignedQuantity,
  })

  test('one product: its name and its units', () => {
    expect(loadSummary([line('Leche', 1)])).toEqual({
      lead: 'Leche',
      extra: 0,
      detail: '1 producto · 1 unidad',
    })
  })

  test('many products: the first, how many more and the total units', () => {
    expect(
      loadSummary([line('Crema', 10), line('Leche', 30), line('Queso', 5)]),
    ).toEqual({ lead: 'Crema', extra: 2, detail: '3 productos · 45 unidades' })
  })

  test('no lines', () => {
    expect(loadSummary([])).toEqual({
      lead: 'Sin productos',
      extra: 0,
      detail: '',
    })
  })
})

describe('whenLabel', () => {
  // 2026-11-17T04:54Z is 22:54 of the 16th in Mexico City.
  const departed = '2026-11-17T04:54:00Z'

  test('today reads as "hoy" and keeps the time apart', () => {
    expect(whenLabel('En ruta', departed, '2026-11-16')).toEqual({
      verb: 'Salió',
      today: true,
    })
  })

  test('another day is not today', () => {
    expect(whenLabel('En ruta', departed, '2026-11-17').today).toBe(false)
  })

  test('each closing state names what happened', () => {
    expect(whenLabel('Liquidada', departed, '2026-11-16').verb).toBe(
      'Se liquidó',
    )
    expect(whenLabel('Cancelada', departed, '2026-11-16').verb).toBe(
      'Se canceló',
    )
  })
})

describe('statusTone', () => {
  test('maps each status to a badge tone', () => {
    expect(statusTone('En ruta')).toBe('blue')
    expect(statusTone('Liquidada')).toBe('green')
    expect(statusTone('Cancelada')).toBe('gray')
  })
})

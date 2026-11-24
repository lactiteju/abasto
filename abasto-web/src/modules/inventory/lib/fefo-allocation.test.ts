import { describe, expect, test } from 'bun:test'
import { allocateFefo } from '#/modules/inventory/lib/fefo-allocation'

const lot = (
  id: string,
  free: number,
  expiresOn: string | null,
  receivedAt = '2026-11-01',
) => ({ id, free, expiresOn, receivedAt: new Date(receivedAt) })

describe('allocateFefo', () => {
  test('takes from the earliest expiry first and spills to the next lot', () => {
    const lots = [lot('late', 10, '2026-12-30'), lot('early', 4, '2026-12-01')]
    expect(allocateFefo(lots, 6)).toEqual({
      taken: [
        { lotId: 'early', quantity: 4 },
        { lotId: 'late', quantity: 2 },
      ],
      missing: 0,
    })
  })

  test('lots without expiry go last; ties go to the oldest received', () => {
    const lots = [
      lot('none', 5, null),
      lot('new', 5, '2026-12-01', '2026-11-10'),
      lot('old', 5, '2026-12-01', '2026-11-02'),
    ]
    expect(allocateFefo(lots, 12).taken.map((t) => t.lotId)).toEqual([
      'old',
      'new',
      'none',
    ])
  })

  test('skips lots with nothing free and never overdraws a lot', () => {
    const lots = [lot('held', 0, '2026-12-01'), lot('ok', 3, '2026-12-02')]
    expect(allocateFefo(lots, 2)).toEqual({
      taken: [{ lotId: 'ok', quantity: 2 }],
      missing: 0,
    })
  })

  test('reports the pieces that no lot can cover', () => {
    expect(allocateFefo([lot('a', 3, null)], 5)).toEqual({
      taken: [{ lotId: 'a', quantity: 3 }],
      missing: 2,
    })
    expect(allocateFefo([], 1).missing).toBe(1)
  })
})

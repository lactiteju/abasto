import { describe, expect, test } from 'bun:test'

import type { AssignableProduct } from './assign-draft'
import { editLoadInputFromDraft } from './edit-load-draft'
import type { EditLoadLine } from './edit-load-draft'

const milk: AssignableProduct = {
  productId: 'milk',
  name: 'Leche',
  boxFactor: 12,
  available: 50,
}
const cola: AssignableProduct = {
  productId: 'cola',
  name: 'Cola',
  boxFactor: 24,
  available: 30,
}

const line = (change: Partial<EditLoadLine> = {}): EditLoadLine => ({
  productId: 'milk',
  productName: 'Leche',
  boxFactor: 12,
  assignedQuantity: 30,
  boxes: '2',
  units: '6',
  removed: false,
  ...change,
})

const draft = (
  lines: Array<EditLoadLine>,
  added: Array<{ productId: string; boxes: string; units: string }> = [],
) => editLoadInputFromDraft('a1', lines, added, [milk, cola])

describe('editLoadInputFromDraft', () => {
  test('sends only the lines whose total changed', () => {
    expect(draft([line()])).toEqual({
      ok: false,
      message: 'No hay cambios que guardar.',
    })
    const result = draft([line({ boxes: '1', units: '' })])
    expect(result).toEqual({
      ok: true,
      value: {
        assignmentId: 'a1',
        changes: [{ productId: 'milk', boxes: 1, units: 0 }],
        add: [],
      },
    })
  })

  test('removed lines become a zero total', () => {
    const result = draft(
      [line({ removed: true })],
      [{ productId: 'cola', boxes: '1', units: '' }],
    )
    expect(result).toEqual({
      ok: true,
      value: {
        assignmentId: 'a1',
        changes: [{ productId: 'milk', boxes: 0, units: 0 }],
        add: [{ productId: 'cola', boxes: 1, units: 0 }],
      },
    })
  })

  test('cannot remove everything', () => {
    const result = draft([line({ removed: true })])
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toContain('cancélalo')
  })

  test('a typed zero asks for Quitar; raises are capped by availability', () => {
    expect(draft([line({ boxes: '', units: '' })]).ok).toBe(false)
    const over = draft([line({ boxes: '10', units: '' })]) // +90 > 50
    expect(!over.ok && over.message).toContain('solo hay 50')
    expect(draft([line({ boxes: '5', units: '' })]).ok).toBe(true) // +30
  })

  test('rejects non-numbers, repeats and incomplete added lines', () => {
    expect(draft([line({ boxes: '1x' })]).ok).toBe(false)
    expect(
      draft(
        [line({ boxes: '1' })],
        [{ productId: 'milk', boxes: '1', units: '' }],
      ).ok,
    ).toBe(false)
    expect(
      draft([line({ boxes: '1' })], [{ productId: '', boxes: '1', units: '' }])
        .ok,
    ).toBe(false)
    expect(
      draft(
        [line({ boxes: '1' })],
        [{ productId: 'cola', boxes: '2', units: '' }],
      ).ok,
    ).toBe(false)
  })
})

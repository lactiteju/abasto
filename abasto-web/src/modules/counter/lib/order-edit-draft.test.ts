import { describe, expect, test } from 'bun:test'
import {
  draftToEdit,
  initialEdits,
  isChanged,
  isRemoved,
  parseEditQuantity,
  removeEdit,
  restoreEdit,
  setEditQuantity,
  stockBalance,
} from '#/modules/counter/lib/order-edit-draft'

const edits = () =>
  initialEdits([
    { presentationId: 'box', productId: 'milk', factor: 12, quantity: 3 },
    { presentationId: 'cola', productId: 'cola', factor: 1, quantity: 5 },
  ])
const message = (result: ReturnType<typeof draftToEdit>) =>
  result.ok ? null : result.message

describe('order edit draft', () => {
  test('starts from the order quantities, nothing changed', () => {
    expect(edits().map((e) => e.quantity)).toEqual(['3', '5'])
    expect(edits().some(isChanged)).toBe(false)
    expect(message(draftToEdit(edits(), []))).toBe(
      'No hay cambios que guardar.',
    )
  })

  test('sends only changed lines; 0 removes; add lines go apart', () => {
    let draft = setEditQuantity(edits(), 'box', '2')
    draft = removeEdit(draft, 'cola')
    expect(isRemoved(draft[1])).toBe(true)
    expect(
      draftToEdit(draft, [{ presentationId: 'new', quantity: '4' }]),
    ).toEqual({
      ok: true,
      value: {
        changes: [
          { presentationId: 'box', quantity: 2 },
          { presentationId: 'cola', quantity: 0 },
        ],
        add: [{ presentationId: 'new', quantity: 4 }],
      },
    })
  })

  test('restore brings the original quantity back', () => {
    const draft = restoreEdit(removeEdit(edits(), 'cola'), 'cola')
    expect(draft[1].quantity).toBe('5')
    expect(draft.some(isChanged)).toBe(false)
  })

  test('refuses removing every line unless something is added', () => {
    let draft = removeEdit(removeEdit(edits(), 'box'), 'cola')
    expect(message(draftToEdit(draft, []))).toContain('Cancelar pedido')
    expect(
      draftToEdit(draft, [{ presentationId: 'new', quantity: '1' }]).ok,
    ).toBe(true)
    draft = setEditQuantity(draft, 'box', '1')
    expect(draftToEdit(draft, []).ok).toBe(true)
  })

  test('refuses letters, decimals, blanks and a zero add', () => {
    for (const text of ['', 'a', '1.5', '-1', '99999999999']) {
      expect(parseEditQuantity(text)).toBeNull()
      expect(
        message(draftToEdit(setEditQuantity(edits(), 'box', text), [])),
      ).toBe('La cantidad de cada producto debe ser un entero de cero o más.')
    }
    expect(parseEditQuantity(' 0 ')).toBe(0)
    expect(
      message(draftToEdit(edits(), [{ presentationId: 'n', quantity: '0' }])),
    ).toBe('La cantidad de cada producto debe ser un entero mayor que cero.')
  })

  test('stock balance: lowering frees base units, raising needs them', () => {
    const draft = setEditQuantity(
      setEditQuantity(edits(), 'box', '1'),
      'cola',
      '9',
    )
    expect(Object.fromEntries(stockBalance(draft))).toEqual({
      milk: 24,
      cola: -4,
    })
    expect(stockBalance(setEditQuantity(edits(), 'box', 'x')).size).toBe(0)
  })
})

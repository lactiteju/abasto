import { describe, expect, test } from 'bun:test'
import {
  clampBoxes,
  summarizeTransfer,
  transferLines,
} from '#/modules/transfers/lib/owner-transfer-draft'

describe('clampBoxes', () => {
  test('keeps digits only and clamps to the available boxes', () => {
    expect(clampBoxes('a1b2', 50)).toBe('12')
    expect(clampBoxes('99', 5)).toBe('5')
    expect(clampBoxes('007', 50)).toBe('7')
    expect(clampBoxes('-', 5)).toBe('')
    expect(clampBoxes('', 5)).toBe('')
  })
})

describe('transferLines', () => {
  test('drops blank and zero rows', () => {
    expect(transferLines({ a: '2', b: '', c: '0' })).toEqual([
      { productId: 'a', boxes: 2 },
    ])
  })
})

describe('summarizeTransfer', () => {
  test('counts products and boxes', () => {
    expect(summarizeTransfer([])).toBe('Sin productos')
    expect(summarizeTransfer([{ boxes: 1 }])).toBe('1 producto · 1 caja')
    expect(summarizeTransfer([{ boxes: 2 }, { boxes: 3 }])).toBe(
      '2 productos · 5 cajas',
    )
  })
})

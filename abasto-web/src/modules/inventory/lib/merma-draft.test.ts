import { describe, expect, test } from 'bun:test'
import {
  clampPieces,
  piecesAvailableLabel,
  typedPieces,
} from '#/modules/inventory/lib/merma-draft'

describe('clampPieces', () => {
  test('keeps digits only and caps to the available pieces', () => {
    expect(clampPieces('1a2', 50)).toBe('12')
    expect(clampPieces('99', 7)).toBe('7')
    expect(clampPieces('007', 50)).toBe('7')
    expect(clampPieces('abc', 5)).toBe('')
    expect(clampPieces('3', 0)).toBe('0')
  })
})

describe('typedPieces', () => {
  test('blank and zero are no pieces', () => {
    expect(typedPieces('')).toBe(0)
    expect(typedPieces('0')).toBe(0)
    expect(typedPieces('4')).toBe(4)
  })
})

describe('labels', () => {
  test('pluralises', () => {
    expect(piecesAvailableLabel(1)).toBe('1 pieza disponible')
    expect(piecesAvailableLabel(5)).toBe('5 piezas disponibles')
  })
})

import { describe, expect, test } from 'bun:test'
import {
  clampBoxesText,
  clampUnitsText,
  reclampUnitsText,
} from '#/modules/riders/lib/leftover-caps'

describe('clampBoxesText', () => {
  test.each([
    ['', 24, 12, ''],
    ['abc', 24, 12, ''],
    ['1a2', 24, 12, '2'],
    ['1', 24, 12, '1'],
    ['2', 24, 12, '2'],
    ['3', 24, 12, '2'],
    ['999', 30, 12, '2'],
    ['5', 5, 12, '0'],
    ['007', 100, 12, '7'],
    ['9', 100, 1, '9'],
  ])('%j (assigned %d, factor %d) -> %j', (raw, assigned, factor, out) => {
    expect(clampBoxesText(raw, assigned, factor)).toBe(out)
  })
})

describe('clampUnitsText', () => {
  test.each([
    ['', 30, 12, '1', ''],
    ['x', 30, 12, '1', ''],
    ['18', 30, 12, '1', '18'],
    ['19', 30, 12, '1', '18'],
    ['999', 30, 12, '', '30'],
    ['5', 30, 12, '9', '0'],
  ])('%j (assigned %d, factor %d, boxes %j) -> %j', (raw, a, f, boxes, out) => {
    expect(clampUnitsText(raw, a, f, boxes)).toBe(out)
  })
})

describe('reclampUnitsText', () => {
  test('lowers units when boxes grow', () => {
    expect(reclampUnitsText('25', 30, 12, '2')).toBe('6')
  })
  test('keeps units that still fit and empty stays empty', () => {
    expect(reclampUnitsText('5', 30, 12, '1')).toBe('5')
    expect(reclampUnitsText('', 30, 12, '2')).toBe('')
  })
})

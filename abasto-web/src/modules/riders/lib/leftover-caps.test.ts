import { describe, expect, test } from 'bun:test'
import {
  clampBoxesText,
  clampScrapText,
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

describe('merma caps', () => {
  test('clampBoxesText leaves room for merma', () => {
    // 30 assigned, box 12: 2 boxes fit, but with 10 of merma only 1 does.
    expect(clampBoxesText('2', 30, 12, 0)).toBe('2')
    expect(clampBoxesText('2', 30, 12, 10)).toBe('1')
  })
  test('clampUnitsText leaves room for merma', () => {
    expect(clampUnitsText('18', 30, 12, '1', 0)).toBe('18')
    expect(clampUnitsText('18', 30, 12, '1', 5)).toBe('13')
  })
  test('clampScrapText is capped by what did not come back', () => {
    expect(clampScrapText('', 30, 0)).toBe('')
    expect(clampScrapText('x9', 30, 0)).toBe('9')
    expect(clampScrapText('99', 30, 0)).toBe('30')
    expect(clampScrapText('99', 30, 25)).toBe('5')
    expect(clampScrapText('4', 30, 30)).toBe('0')
  })
})

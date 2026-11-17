import { describe, expect, test } from 'bun:test'

import {
  decimalInput,
  digitsOnly,
  numericSanitizer,
  sanitizeChange,
} from '#/lib/numeric-input'

describe('digitsOnly', () => {
  test('drops letters, points and signs', () => {
    expect(digitsOnly('a1b2.5-c')).toBe('125')
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('')).toBe('')
  })
})

describe('decimalInput', () => {
  test('keeps digits and one point', () => {
    expect(decimalInput('12.5')).toBe('12.5')
    expect(decimalInput('1a2.5b')).toBe('12.5')
    expect(decimalInput('1.2.3')).toBe('1.23')
    expect(decimalInput('.5')).toBe('.5')
    expect(decimalInput('5.')).toBe('5.')
    expect(decimalInput('-5')).toBe('5')
  })
  test('limits decimals', () => {
    expect(decimalInput('1.239')).toBe('1.23')
    expect(decimalInput('1.23456', 4)).toBe('1.2345')
    expect(decimalInput('1.239', 0)).toBe('1.')
  })
})

describe('numericSanitizer', () => {
  test('only numeric and decimal modes sanitize', () => {
    expect(numericSanitizer('numeric')?.('1a')).toBe('1')
    expect(numericSanitizer('decimal')?.('1.234')).toBe('1.23')
    expect(numericSanitizer('text')).toBeNull()
    expect(numericSanitizer(undefined)).toBeNull()
  })
})

describe('sanitizeChange', () => {
  test('rewrites the target value and keeps the caret', () => {
    const target = {
      value: '12a3',
      selectionStart: 3,
      setSelectionRange(start: number) {
        this.selectionStart = start
      },
    }
    sanitizeChange({ target } as never, 'numeric')
    expect(target.value).toBe('123')
    expect(target.selectionStart).toBe(2)
  })
  test('leaves free text untouched', () => {
    const target = { value: 'abc', selectionStart: 3 }
    sanitizeChange({ target } as never, undefined)
    expect(target.value).toBe('abc')
  })
})

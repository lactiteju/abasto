import { describe, expect, test } from 'bun:test'
import {
  defaultFolioPrefix,
  normalizeFolioPrefix,
} from '#/modules/catalog/lib/folio-prefix'

describe('normalizeFolioPrefix', () => {
  test('uppercases and trims valid keys of one to three letters', () => {
    expect(normalizeFolioPrefix(' a ')).toBe('A')
    expect(normalizeFolioPrefix('lal')).toBe('LAL')
  })

  test('rejects empty, digits, accents and more than three letters', () => {
    for (const bad of ['', '  ', 'A1', 'Ñ', 'ABCD', 'A-B', 'á']) {
      expect(normalizeFolioPrefix(bad)).toBeNull()
    }
  })
})

describe('defaultFolioPrefix', () => {
  test('is the initial of the name, accents stripped', () => {
    expect(defaultFolioPrefix('Alpura', [])).toBe('A')
    expect(defaultFolioPrefix('  ácido', [])).toBe('A')
    expect(defaultFolioPrefix('Ñandú', [])).toBe('N')
  })

  test('is case-insensitive about the taken keys', () => {
    expect(defaultFolioPrefix('Alpura', ['a'])).toBe('AL')
  })

  test('falls back to the first two letters, then the initial plus a consonant', () => {
    expect(defaultFolioPrefix('Alpura', ['A'])).toBe('AL')
    expect(defaultFolioPrefix('Alpura', ['A', 'AL'])).toBe('AP')
    expect(defaultFolioPrefix('Alpura', ['A', 'AL', 'AP'])).toBe('AR')
  })

  test('always finds a free key and never repeats a taken one', () => {
    const taken: Array<string> = []
    for (let i = 0; i < 40; i++) {
      const next = defaultFolioPrefix('Alpura', taken)
      expect(taken).not.toContain(next)
      expect(next).toMatch(/^[A-Z]{1,3}$/)
      taken.push(next)
    }
  })

  test('works for names without letters', () => {
    expect(defaultFolioPrefix('123', [])).toMatch(/^[A-Z]$/)
  })
})

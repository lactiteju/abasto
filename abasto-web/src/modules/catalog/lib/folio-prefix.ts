const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const VOWELS = 'AEIOU'

/** Message shown when a supplier folio key is not 1–3 letters A–Z. */
export const invalidFolioPrefix =
  'La clave de folio son de 1 a 3 letras de la A a la Z.'

/** A trimmed, uppercased folio key, or null when it is not 1–3 letters A–Z. */
export function normalizeFolioPrefix(raw: string): string | null {
  const value = raw.trim().toUpperCase()
  return /^[A-Z]{1,3}$/.test(value) ? value : null
}

/** The letters A–Z of a name, accents stripped (`Ñandú` → `NANDU`). */
function lettersOf(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

/** Candidate keys in preference order; may repeat, callers take the first free one. */
function* candidates(name: string): Generator<string> {
  const letters = lettersOf(name) || 'S'
  const first = letters[0]
  const rest = [...letters.slice(1)]
  yield first
  if (rest.length) yield first + rest[0]
  for (const letter of rest.filter((l) => !VOWELS.includes(l))) {
    yield first + letter
  }
  for (const letter of rest) yield first + letter
  for (const letter of ALPHABET) yield first + letter
  for (const second of ALPHABET) {
    for (const third of ALPHABET) yield first + second + third
  }
  for (const a of ALPHABET) {
    for (const b of ALPHABET) {
      for (const c of ALPHABET) yield a + b + c
    }
  }
}

/**
 * Default folio key for a new supplier: its initial; when taken, the first two
 * letters, then the initial plus its next consonants and letters, then any
 * free key. Comparison with `taken` ignores case.
 */
export function defaultFolioPrefix(
  name: string,
  taken: ReadonlyArray<string>,
): string {
  const used = new Set(taken.map((prefix) => prefix.toUpperCase()))
  for (const candidate of candidates(name)) {
    if (!used.has(candidate)) return candidate
  }
  throw new Error('No hay claves de folio disponibles.')
}

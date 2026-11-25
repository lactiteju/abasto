/** Keeps only digits and caps the number to what is available. */
export function clampPieces(typed: string, available: number): string {
  const digits = typed.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return Number(digits) > available ? String(Math.max(0, available)) : digits
}

/** Whole pieces typed, or 0 when blank or zero. */
export function typedPieces(typed: string): number {
  const pieces = Number(typed)
  return Number.isInteger(pieces) && pieces > 0 ? pieces : 0
}

/** «1 pieza disponible» / «N piezas disponibles». */
export const piecesAvailableLabel = (pieces: number) =>
  `${pieces} ${pieces === 1 ? 'pieza disponible' : 'piezas disponibles'}`

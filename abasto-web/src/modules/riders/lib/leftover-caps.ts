/** Typed «Regresó» fields: digits only, never above what was assigned. */

const digitsOf = (raw: string) => raw.replace(/\D/g, '')

function clampText(raw: string, cap: number): string {
  const digits = digitsOf(raw)
  if (digits === '') return ''
  const value = Number(digits)
  return String(Math.min(value, Math.max(0, cap)))
}

const boxesOf = (boxesText: string) => Number(digitsOf(boxesText) || 0)

/** Whole boxes assigned is the most that can come back. */
export function clampBoxesText(
  raw: string,
  assignedQuantity: number,
  boxFactor: number,
): string {
  return clampText(raw, Math.floor(assignedQuantity / boxFactor))
}

/** Units are capped by what is left after the typed boxes. */
export function clampUnitsText(
  raw: string,
  assignedQuantity: number,
  boxFactor: number,
  boxesText: string,
): string {
  return clampText(raw, assignedQuantity - boxesOf(boxesText) * boxFactor)
}

/** Re-applies the units cap after the boxes changed. */
export const reclampUnitsText = clampUnitsText

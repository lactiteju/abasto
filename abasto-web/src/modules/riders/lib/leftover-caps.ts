/**
 * Typed «Regresó» and «Merma» fields: digits only; returned + merma never go
 * above what was assigned.
 */

const digitsOf = (raw: string) => raw.replace(/\D/g, '')

function clampText(raw: string, cap: number): string {
  const digits = digitsOf(raw)
  if (digits === '') return ''
  const value = Number(digits)
  return String(Math.min(value, Math.max(0, cap)))
}

const boxesOf = (boxesText: string) => Number(digitsOf(boxesText) || 0)

/** Whole boxes left after the merma is the most that can come back. */
export function clampBoxesText(
  raw: string,
  assignedQuantity: number,
  boxFactor: number,
  scrap = 0,
): string {
  return clampText(raw, Math.floor((assignedQuantity - scrap) / boxFactor))
}

/** Units are capped by what is left after the typed boxes. */
export function clampUnitsText(
  raw: string,
  assignedQuantity: number,
  boxFactor: number,
  boxesText: string,
  scrap = 0,
): string {
  return clampText(
    raw,
    assignedQuantity - scrap - boxesOf(boxesText) * boxFactor,
  )
}

/** Merma (pieces) is capped by what did not come back. */
export function clampScrapText(
  raw: string,
  assignedQuantity: number,
  returnedQuantity: number,
): string {
  return clampText(raw, assignedQuantity - returnedQuantity)
}

/** Re-applies the units cap after the boxes changed. */
export const reclampUnitsText = clampUnitsText

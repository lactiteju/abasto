import { parseSignedPesos } from '#/modules/pricing/lib/money'
import { priceSold } from '#/modules/riders/lib/allocation-pricing'
import type { PricedAllocation } from '#/modules/riders/lib/allocation-pricing'

export type PreviewAllocation = PricedAllocation

export type PreviewLine = {
  assignedQuantity: number
  boxFactor: number
  /** Oldest lot first, as the server settles them. */
  allocations: ReadonlyArray<PreviewAllocation>
  /** Typed leftover, boxes and loose units. */
  boxes: string
  units: string
  /** Typed merma in pieces; blank is zero. */
  scrap?: string
}

export type LinePreview = {
  /** Base units that come back. */
  leftover: number
  /** Merma in base units: damaged, neither sold nor returned. */
  scrap: number
  /** Base units sold (assigned − leftover − merma). */
  sold: number
  expectedCents: number
  error?: string
}

export type SettlementPreview = {
  lines: Array<LinePreview>
  expectedCents: number
  deliveredCents: number | null
  deliveredError?: string
  differenceCents: number | null
  kind: 'exact' | 'shortage' | 'surplus' | null
  valid: boolean
}

const wholeError = 'Escribe un número entero, cero o más.'

/** Blank counts as zero; anything but digits is an error. */
function parseWhole(text: string): number | null {
  const clean = text.trim()
  if (clean === '') return 0
  if (!/^\d+$/.test(clean)) return null
  const value = Number(clean)
  return Number.isSafeInteger(value) ? value : null
}

function previewLine(line: PreviewLine): LinePreview {
  const boxes = parseWhole(line.boxes)
  const units = parseWhole(line.units)
  const scrap = parseWhole(line.scrap ?? '')
  if (boxes === null || units === null || scrap === null) {
    return {
      leftover: 0,
      scrap: 0,
      sold: line.assignedQuantity,
      expectedCents: 0,
      error: wholeError,
    }
  }
  const leftover = boxes * line.boxFactor + units
  if (leftover + scrap > line.assignedQuantity) {
    return {
      leftover,
      scrap,
      sold: 0,
      expectedCents: 0,
      error:
        scrap > 0
          ? 'Lo que regresó más la merma no puede ser más de lo que se asignó.'
          : 'No puede regresar más de lo que se asignó.',
    }
  }
  const sold = line.assignedQuantity - leftover - scrap
  // Same split as the server: whole boxes at the box price, loose pieces at
  // the piece price, sold from the oldest allocations first.
  const expectedCents = priceSold(line.allocations, sold).reduce(
    (sum, item) => sum + item.cents,
    0,
  )
  return { leftover, scrap, sold, expectedCents }
}

/**
 * What settling would do with the typed leftovers and delivered cash: sold
 * per line, the expected amount and the shortage or surplus.
 */
export function previewSettlement(
  lines: ReadonlyArray<PreviewLine>,
  deliveredText: string,
): SettlementPreview {
  const previews = lines.map(previewLine)
  const expectedCents = previews.reduce((sum, p) => sum + p.expectedCents, 0)
  const parsed = parseSignedPesos(deliveredText)
  let deliveredCents: number | null = null
  let deliveredError: string | undefined
  if (parsed.ok && parsed.value < 0) {
    deliveredError = 'El monto no puede ser negativo.'
  } else if (parsed.ok) {
    deliveredCents = parsed.value
  } else {
    deliveredError = parsed.message
  }
  const differenceCents =
    deliveredCents === null ? null : deliveredCents - expectedCents
  const kind =
    differenceCents === null
      ? null
      : differenceCents === 0
        ? 'exact'
        : differenceCents < 0
          ? 'shortage'
          : 'surplus'
  return {
    lines: previews,
    expectedCents,
    deliveredCents,
    ...(deliveredError ? { deliveredError } : {}),
    differenceCents,
    kind,
    valid: deliveredCents !== null && previews.every((p) => !p.error),
  }
}

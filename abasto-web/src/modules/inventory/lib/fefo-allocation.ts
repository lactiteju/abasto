import { byFefo } from '#/modules/inventory/services/stock-ledger'

export type FefoLot = {
  id: string
  /** Units that may leave the lot: on hand minus held by orders. */
  free: number
  expiresOn: string | null
  receivedAt: Date
}

export type FefoAllocation = {
  taken: Array<{ lotId: string; quantity: number }>
  /** Pieces no lot could cover; zero when the request fits. */
  missing: number
}

/**
 * Spreads `pieces` over the lots earliest expiry first (no expiry last, ties
 * by oldest received, then id), never taking more than a lot's free units.
 */
export function allocateFefo(
  lots: ReadonlyArray<FefoLot>,
  pieces: number,
): FefoAllocation {
  const ordered = [...lots].sort(
    (a, b) => byFefo(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const taken: FefoAllocation['taken'] = []
  let missing = pieces
  for (const lot of ordered) {
    if (missing <= 0) break
    const quantity = Math.min(lot.free, missing)
    if (quantity <= 0) continue
    taken.push({ lotId: lot.id, quantity })
    missing -= quantity
  }
  return { taken, missing }
}

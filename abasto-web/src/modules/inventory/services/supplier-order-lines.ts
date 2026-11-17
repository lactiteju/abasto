import { AppError } from '#/lib/errors'
import { grossLineCents, netLineCents } from '#/lib/utils/supplier-cost'
import { fitsInt4 } from '#/modules/inventory/services/stock-ledger'

export const orderTooBig = () =>
  new AppError('invalid', 'El pedido es demasiado grande.')

/** Supplier terms of a line: list price, discount and promotion per piece (ten-thousandths). */
export type LineTerms = {
  listPricePerPiece: number
  fixedDiscountPerPiece: number
  promotionPerPiece: number
}

/**
 * Quantity and costs of an order line: gross = pieces × list price, net =
 * gross − pieces × (discount + promotion), each rounded half up to cents once.
 * Shared by creating and editing an order so both follow one cost rule.
 */
export function priceOrderLine(quantity: number, terms: LineTerms) {
  if (!fitsInt4(quantity)) throw orderTooBig()
  const grossCostCents = grossLineCents(quantity, terms.listPricePerPiece)
  if (!fitsInt4(grossCostCents)) throw orderTooBig()
  const totalCostCents = netLineCents(
    grossCostCents,
    quantity,
    terms.fixedDiscountPerPiece,
    terms.promotionPerPiece,
  )
  if (totalCostCents < 0) {
    throw new AppError(
      'invalid',
      'El descuento y la promoción no pueden superar el costo por pieza.',
    )
  }
  return { quantity, grossCostCents, totalCostCents }
}

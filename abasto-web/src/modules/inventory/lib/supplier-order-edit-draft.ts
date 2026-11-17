import { parseBoxCount } from '#/modules/inventory/lib/box-count'
import { fail } from '#/modules/inventory/lib/parsed'
import type { Parsed } from '#/modules/inventory/lib/parsed'
import {
  NO_BOXES_MESSAGE,
  orderInputFromDraft,
} from '#/modules/inventory/lib/supplier-order-draft'
import type {
  OrderDraft,
  OrderProduct,
} from '#/modules/inventory/lib/supplier-order-draft'
import type { SupplierOrderEditInput } from '#/modules/inventory/services/supplier-order-edit'

export const EMPTY_ORDER_MESSAGE =
  'El pedido no puede quedar sin productos. Para descartarlo usa «Cancelar pedido».'

/** What the editor needs of a line already on the order. */
export type EditableLine = {
  productId: string
  boxes: number
  boxFactor: number
  listPricePerPiece: number
  fixedDiscountPerPiece: number
  promotionPerPiece: number
}

/** The order as the new-order form state: its boxes by product, nothing else to choose. */
export function draftFromOrder(order: {
  supplierId: string
  warehouseId: string
  expectedOn: string | null
  lines: ReadonlyArray<Pick<EditableLine, 'productId' | 'boxes'>>
}): OrderDraft {
  return {
    supplierId: order.supplierId,
    warehouseId: order.warehouseId,
    expectedOn: order.expectedOn ?? '',
    boxes: Object.fromEntries(
      order.lines.map((line) => [line.productId, String(line.boxes)]),
    ),
  }
}

/**
 * Catalog products with the terms frozen on the order's own lines (price,
 * discount, promotion, box factor), so the editor's figures match what the
 * server stores: lines already on the order keep their terms, added ones use
 * the catalog's.
 */
export function productsForEdit<TProduct extends OrderProduct>(
  products: ReadonlyArray<TProduct>,
  lines: ReadonlyArray<EditableLine>,
): Array<TProduct> {
  const byProduct = new Map(lines.map((line) => [line.productId, line]))
  return products.map((product) => {
    const line = byProduct.get(product.id)
    if (!line) return product
    return {
      ...product,
      listPricePerPiece: line.listPricePerPiece,
      fixedDiscountPerPiece: line.fixedDiscountPerPiece,
      promotionPerPiece: line.promotionPerPiece,
      presentations: [
        { factor: line.boxFactor, active: true, isDefault: true },
        ...product.presentations.map((item) => ({
          ...item,
          isDefault: false,
        })),
      ],
    }
  })
}

/** Parse result of the editor; a failure caused by one row names its product. */
export type EditParsed =
  | Parsed<SupplierOrderEditInput>
  | { ok: false; message: string; productId: string }

/**
 * Editor form → server input. Order lines whose product is not among the
 * shown products (e.g. archived since) are kept as they are, never dropped
 * silently; removing a line means clearing its boxes.
 */
export function editInputFromDraft(
  purchaseId: string,
  draft: OrderDraft,
  products: ReadonlyArray<OrderProduct>,
): EditParsed {
  const parsed = orderInputFromDraft(draft, products)
  const lines: SupplierOrderEditInput['lines'] = []
  if (parsed.ok) lines.push(...parsed.value.lines)
  else if (parsed.message !== NO_BOXES_MESSAGE) return parsed
  const shown = new Set(products.map((product) => product.id))
  for (const [productId, text] of Object.entries(draft.boxes)) {
    if (shown.has(productId)) continue
    const boxes = parseBoxCount(text ?? '')
    if (boxes.ok && boxes.value > 0) {
      lines.push({ productId, boxes: boxes.value })
    }
  }
  if (!lines.length) return fail(EMPTY_ORDER_MESSAGE)
  return { ok: true, value: { purchaseId, lines } }
}

/**
 * Notice under the editor's totals when the applied discounts no longer fit
 * the new net total (the server reopens the most recent ones); null otherwise.
 */
export const discountReopenNote = (discountCents: number, netCents: number) =>
  discountCents > netCents
    ? 'Los descuentos aplicados superan el nuevo total: al guardar se reabrirán los más recientes hasta que quepan.'
    : null

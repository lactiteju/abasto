import type { AssignableProduct } from '#/modules/riders/lib/assign-draft'

type SupplierOption = { id: string; name: string; active: boolean }

const DEFAULT_SUPPLIER_NAME = 'lala'

/** Suppliers of the assignable products, once each and by name. */
export function assignableSuppliers(
  products: ReadonlyArray<
    Pick<AssignableProduct, 'supplierId' | 'supplierName'>
  >,
): Array<SupplierOption> {
  const byId = new Map<string, string>()
  for (const { supplierId, supplierName } of products) {
    if (supplierId && supplierName) byId.set(supplierId, supplierName)
  }
  return [...byId]
    .map(([id, name]) => ({ id, name, active: true }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** The LALA supplier id (name matched case-insensitively), or "" (Todos). */
export function defaultSupplierId(
  suppliers: ReadonlyArray<Pick<SupplierOption, 'id' | 'name'>>,
): string {
  return (
    suppliers.find(
      (supplier) =>
        supplier.name.trim().toLowerCase() === DEFAULT_SUPPLIER_NAME,
    )?.id ?? ''
  )
}

/** Narrows the picker to one supplier; "" keeps every product. */
export function filterBySupplier<
  T extends Pick<AssignableProduct, 'productId' | 'supplierId'>,
>(
  products: ReadonlyArray<T>,
  supplierId: string,
  keepIds: ReadonlyArray<string> = [],
): Array<T> {
  if (!supplierId) return [...products]
  return products.filter(
    (product) =>
      product.supplierId === supplierId || keepIds.includes(product.productId),
  )
}

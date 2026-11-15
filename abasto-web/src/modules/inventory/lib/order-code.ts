/**
 * Supplier-order folio: the supplier's key plus its consecutive padded to
 * five digits (`A00001`, `L00012`).
 */
export const supplierFolio = (prefix: string, consecutive: number) =>
  `${prefix}${String(consecutive).padStart(5, '0')}`

/**
 * The code shared by every lot an order creates: its reference when it has
 * one, else `PED-` plus the order folio padded to four digits (`PED-0007`).
 * The folio is a sequential number assigned once, so the code never changes.
 */
export const orderCode = (order: { reference: string; folio: number }) =>
  order.reference.trim() || `PED-${String(order.folio).padStart(4, '0')}`

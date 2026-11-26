import type {
  PendingBalance,
  PendingEntry,
} from '#/modules/inventory/services/supplier-pendings'
import type { SupplierOrderSummary } from '#/modules/inventory/services/supplier-orders'
import type { TransfersOverview } from '#/modules/transfers/types/transfers'

/** What the Inventario panels load after the products table. */
export type InventorySecondary = {
  transfers: TransfersOverview
  /** Supplier orders of the selected warehouse, newest first. */
  supplierOrders: Array<SupplierOrderSummary>
  /** What suppliers owe, with its ledger history. */
  pendings: {
    restock: Array<PendingBalance>
    returns: Array<PendingBalance>
    credits: Array<PendingBalance>
    history: Array<PendingEntry>
  }
}

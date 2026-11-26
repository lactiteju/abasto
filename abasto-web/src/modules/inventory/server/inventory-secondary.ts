import { createServerFn } from '@tanstack/react-start'
import { parseInput } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import { can } from '#/modules/access/lib/policy'
import { overviewInput } from '#/modules/inventory/lib/inventory-inputs'
import { listSupplierOrders } from '#/modules/inventory/services/supplier-order-reads'
import { listSupplierPendings } from '#/modules/inventory/services/supplier-pendings'
import type { InventorySecondary } from '#/modules/inventory/types/secondary'
import {
  listTransferDestinations,
  listWarehouseTransfers,
} from '#/modules/transfers/services/transfer-reads'
import { listWarehouses } from '#/modules/warehouses/services/warehouses'

const emptyPendings = { restock: [], returns: [], credits: [], history: [] }

/**
 * What the secondary Inventario panels need (transfers, supplier orders and
 * balances) for the warehouse `inventoryOverviewFn` selects. It resolves that
 * warehouse itself, so the route can request both at once instead of waiting
 * for the overview to know the id.
 */
export const inventorySecondaryFn = createServerFn({ method: 'GET' })
  .validator((data: { warehouseId?: string }) => data)
  .handler(({ data }) =>
    runWithActor(async (actor): Promise<InventorySecondary> => {
      const { warehouseId } = parseInput(overviewInput, data)
      const warehouses = await listWarehouses(actor)
      const selected =
        warehouses.find(({ id }) => id === warehouseId) ?? warehouses.at(0)
      if (!selected) {
        return {
          transfers: { transfers: [], destinations: [] },
          supplierOrders: [],
          pendings: emptyPendings,
        }
      }
      // Orders and balances are only for managers of the warehouse.
      const manages = can(actor, 'warehouse.manage', selected.id)
      const [transfers, destinations, supplierOrders, pendings] =
        await Promise.all([
          listWarehouseTransfers(actor, selected.id),
          manages ? listTransferDestinations(actor, selected.id) : [],
          manages
            ? listSupplierOrders(actor, { warehouseId: selected.id })
            : [],
          manages ? listSupplierPendings(actor) : emptyPendings,
        ])
      return {
        transfers: { transfers, destinations },
        supplierOrders,
        pendings,
      }
    }),
  )

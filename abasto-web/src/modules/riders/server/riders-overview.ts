import { can } from '#/modules/access/lib/policy'
import type { Actor } from '#/modules/access/lib/policy'
import { getOpenCashSession } from '#/modules/cash/services/cash-sessions'
import { now as clockNow, businessDate } from '#/modules/orders/services/clock'
import { currentAssignments } from '#/modules/riders/lib/assignment-view'
import { lastSettledByRider } from '#/modules/riders/lib/next-assignment'
import type { SettledLine } from '#/modules/riders/lib/next-assignment'
import { listAssignableProducts } from '#/modules/riders/services/assignable-products'
import {
  getAssignment,
  listAssignments,
} from '#/modules/riders/services/assignment-reads'
import { listRiders } from '#/modules/riders/services/riders'
import type { RidersOverview } from '#/modules/riders/lib/riders-view'
import { listWarehouses } from '#/modules/warehouses/services/warehouses'

/** The selected warehouse (or the first operable one) with riders and today's assignments. */
export async function getRidersOverview(
  actor: Actor,
  warehouseId?: string,
): Promise<RidersOverview> {
  const warehouses = (await listWarehouses(actor)).filter(({ id }) =>
    can(actor, 'warehouse.operate', id),
  )
  const selected =
    warehouses.find(({ id }) => id === warehouseId) ?? warehouses.at(0)
  const now = new Date()
  if (!selected) {
    return {
      warehouses,
      selectedId: null,
      now,
      canManageRiders: false,
      riders: [],
      cash: null,
      assignments: [],
      products: [],
      leftovers: {},
    }
  }
  const [riders, cash, summaries, products] = await Promise.all([
    listRiders(actor, { warehouseId: selected.id }),
    getOpenCashSession(actor, selected.id),
    listAssignments(actor, { warehouseId: selected.id }),
    listAssignableProducts(actor, selected.id),
  ])
  const assignments = await Promise.all(
    currentAssignments(summaries, businessDate(clockNow())).map(({ id }) =>
      getAssignment(actor, id),
    ),
  )
  const leftovers: Record<string, Array<SettledLine>> = {}
  for (const [riderId, assignmentId] of lastSettledByRider(summaries)) {
    const settled =
      assignments.find(({ id }) => id === assignmentId) ??
      (await getAssignment(actor, assignmentId))
    const back = settled.lines
      .filter((line) => (line.leftoverQuantity ?? 0) > 0)
      .map(({ productId, productName, leftoverQuantity }) => ({
        productId,
        productName,
        leftoverQuantity,
      }))
    if (back.length) leftovers[riderId] = back
  }
  return {
    warehouses,
    selectedId: selected.id,
    now,
    canManageRiders: can(actor, 'riders.manage'),
    riders,
    cash,
    assignments,
    products,
    leftovers,
  }
}

import type { CashSessionDetail } from '#/modules/cash/services/cash-sessions'
import type { AssignableProduct } from '#/modules/riders/lib/assign-draft'
import type { SettledLine } from '#/modules/riders/lib/next-assignment'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import type { Rider } from '#/modules/riders/services/riders'

export type RiderWarehouse = { id: string; name: string }

/** Everything Repartos needs for one warehouse. */
export type RidersOverview = {
  /** Warehouses the actor can operate. */
  warehouses: Array<RiderWarehouse>
  selectedId: string | null
  /** Server time, so dates render the same on server and client. */
  now: Date
  /** Only the owner sees and edits the riders catalog. */
  canManageRiders: boolean
  riders: Array<Rider>
  /** The warehouse's open drawer; settling needs it. */
  cash: CashSessionDetail | null
  /** Open assignments plus today's, newest first, with their lines. */
  assignments: Array<AssignmentDetail>
  /** Products with stock to hand out, with the box factor used. */
  products: Array<AssignableProduct>
  /**
   * By rider id, what came back from their last settled assignment (only
   * riders whose newest assignment is settled with something back). «Nuevo
   * reparto» starts with it.
   */
  leftovers: Record<string, Array<SettledLine>>
}

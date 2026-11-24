import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { parseInput } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import { getRiderWeeklyReport } from '#/modules/reports/services/rider-weekly'

const riderWeeklyInput = z.object({
  weekStart: z.string().min(1).optional(),
  warehouseId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
})

/** The weekly "Repartos" report for the owner or a manager; the service checks the scope. */
export const riderWeeklyFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => data)
  .handler(({ data }) =>
    runWithActor((actor) =>
      getRiderWeeklyReport(actor, parseInput(riderWeeklyInput, data)),
    ),
  )

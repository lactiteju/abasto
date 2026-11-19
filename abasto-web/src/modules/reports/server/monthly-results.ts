import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { parseInput } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import { getMonthlyResults } from '#/modules/reports/services/monthly-results'

const monthlyResultsInput = z.object({
  month: z.string().min(1),
  warehouseId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
})

/** The monthly sheet for the owner or a manager; the service checks the scope. */
export const monthlyResultsFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => data)
  .handler(({ data }) =>
    runWithActor((actor) =>
      getMonthlyResults(actor, parseInput(monthlyResultsInput, data)),
    ),
  )

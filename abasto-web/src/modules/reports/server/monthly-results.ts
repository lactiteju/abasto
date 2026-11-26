import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { parseInput } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import { getMonthlyResults } from '#/modules/reports/services/monthly-results'

const scope = {
  warehouseId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
}

/** A calendar month (Resultados del mes) or the range on screen (Excel downloads). */
const monthlyResultsInput = z.union([
  z.object({ month: z.string().min(1), ...scope }),
  z.object({ from: z.string().min(1), to: z.string().min(1), ...scope }),
])

/** The monthly sheet (or one range of days) for the owner or a manager; the service checks the scope. */
export const monthlyResultsFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => data)
  .handler(({ data }) =>
    runWithActor((actor) =>
      getMonthlyResults(actor, parseInput(monthlyResultsInput, data)),
    ),
  )

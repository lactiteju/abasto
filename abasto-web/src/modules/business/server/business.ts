import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { parseInput, runBoundary } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import {
  getBusiness,
  updateBusiness,
} from '#/modules/business/services/business'

const updateInput = z.object({ name: z.string(), location: z.string() })

/** Public (the customer store and the login show it too); it is not sensitive. */
export const getBusinessFn = createServerFn({ method: 'GET' }).handler(() =>
  runBoundary(() => getBusiness()),
)

export const updateBusinessFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; location: string }) => data)
  .handler(({ data }) =>
    runWithActor((actor) =>
      updateBusiness(actor, parseInput(updateInput, data)),
    ),
  )

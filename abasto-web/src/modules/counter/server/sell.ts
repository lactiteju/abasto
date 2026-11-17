import { createServerFn } from '@tanstack/react-start'
import { parseInput } from '#/lib/boundary'
import { runWithActor } from '#/lib/server-actor'
import { sellOrderInput } from '#/modules/orders/server/order-inputs'
import { sellNow } from '#/modules/orders/services/sell-now'

/** Creates the order and delivers it paid in cash, atomically. */
export const counterSellFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => data)
  .handler(({ data }) =>
    runWithActor((actor) => {
      const { payment, ...order } = parseInput(sellOrderInput, data)
      return sellNow(actor, order, payment)
    }),
  )

import { z } from 'zod'

const id = z.string().min(1)

export const createOrderInput = z.object({
  warehouseId: id,
  customerId: id,
  notes: z.string().optional(),
  lines: z.array(z.object({ presentationId: id, quantity: z.number().int() })),
})

export const orderIdInput = z.object({ orderId: id })

/** Units to add to a reserved order, per presentation. */
export const addToOrderInput = orderIdInput.extend({
  lines: z.array(z.object({ presentationId: id, quantity: z.number().int() })),
})

/**
 * Edit of a reserved order: new total quantity per existing line (0 removes
 * it) and units to add of other products.
 */
export const editOrderInput = orderIdInput.extend({
  changes: z.array(
    z.object({ presentationId: id, quantity: z.number().int() }),
  ),
  add: z.array(z.object({ presentationId: id, quantity: z.number().int() })),
})

/** Payment is optional here so the service answers with its own message. */
export const pickupOrderInput = orderIdInput.extend({
  payment: z
    .object({
      terms: z.literal('contado'),
      tenderedCents: z.number().int(),
    })
    .optional(),
})

export const reservationHoursInput = z.object({ hours: z.number().int() })

/** Same lines as an order, without notes: a read-only price quote. */
export const quoteOrderInput = createOrderInput.omit({ notes: true })

/**
 * A counter sale: the order lines, the total the cashier saw, and how it is
 * paid (checked by the service).
 */
export const sellOrderInput = createOrderInput.extend({
  expectedTotalCents: z.number().int(),
  payment: pickupOrderInput.shape.payment,
})

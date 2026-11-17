import { useEffect, useRef, useState } from 'react'

import { unwrap } from '#/lib/boundary'
import { parseQuantity } from '#/modules/counter/lib/order-draft'
import type { DraftLine } from '#/modules/counter/lib/order-draft'
import { quoteOrderFn } from '#/modules/counter/server/counter'
import type { QuotePreview } from '#/modules/counter/server/quote-preview'

const DEBOUNCE_MS = 300

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; quote: QuotePreview }

/**
 * Quote shown while composing an order: the warehouse price after the
 * customer's rule, from the server. Lines with an invalid quantity are skipped.
 * Raising `refreshToken` re-runs the quote for the same lines and keeps the
 * previous quote on screen until the new one arrives.
 */
export function useOrderQuote(
  warehouseId: string,
  customerId: string,
  lines: Array<DraftLine>,
  refreshToken = 0,
): QuoteState {
  const [state, setState] = useState<QuoteState>({ status: 'idle' })
  const key = lines.map((l) => `${l.presentationId}:${l.quantity}`).join('|')
  const shownFor = useRef('')

  useEffect(() => {
    const quotable = lines.flatMap((line) => {
      const quantity = parseQuantity(line.quantity)
      return quantity === null
        ? []
        : [{ presentationId: line.presentationId, quantity }]
    })
    if (!customerId || !warehouseId || !quotable.length) {
      shownFor.current = ''
      setState({ status: 'idle' })
      return
    }
    let stale = false
    const refreshing =
      shownFor.current === `${warehouseId}|${customerId}|${key}`
    shownFor.current = `${warehouseId}|${customerId}|${key}`
    if (!refreshing) setState({ status: 'loading' })
    const timer = setTimeout(async () => {
      try {
        const quote = unwrap(
          await quoteOrderFn({
            data: { warehouseId, customerId, lines: quotable },
          }),
        )
        if (!stale) setState({ status: 'ready', quote })
      } catch (failure) {
        if (!stale) {
          setState({
            status: 'error',
            message:
              failure instanceof Error
                ? failure.message
                : 'No pudimos cotizar.',
          })
        }
      }
    }, DEBOUNCE_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
    // `key` stands for the line contents.
  }, [warehouseId, customerId, key, refreshToken])

  return state
}

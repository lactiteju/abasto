import { useState } from 'react'
import { toast } from 'sonner'

import { useBusiness } from '#/modules/business/hooks/use-business'
import { useOrderActions } from '#/modules/counter/hooks/use-order-actions'
import { noteFailureMessage } from '#/modules/counter/lib/note-failure'
import { buildRemissionNote } from '#/modules/counter/lib/remission-note'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

/**
 * Downloads the «Nota PDF» of an order: fetches its detail (unless given),
 * builds the note and draws it. Errors surface as a toast.
 */
export function useRemissionNote(warehouseName: string) {
  const actions = useOrderActions()
  const business = useBusiness()
  const [pending, setPending] = useState(false)

  async function download(orderId: string, loaded?: OrderDetail) {
    setPending(true)
    try {
      const order = loaded ?? (await actions.detail(orderId))
      const note = buildRemissionNote(order, {
        business: business.name,
        warehouseName,
      })
      const { downloadRemissionNote } =
        await import('#/modules/counter/lib/remission-note-pdf')
      await downloadRemissionNote(note)
    } catch (failure) {
      console.error('Nota PDF', failure)
      toast.error(noteFailureMessage(failure))
    } finally {
      setPending(false)
    }
  }

  return { pending, download }
}

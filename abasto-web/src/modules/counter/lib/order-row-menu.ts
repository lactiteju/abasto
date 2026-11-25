import type { RowMenuItem } from '#/components/row-actions-menu'

type RowMenuInput = {
  status: string
  /** Owner only: «Editar venta» on delivered rows. */
  canReopen: boolean
  pdfPending: boolean
  reopenPending: boolean
  onView: () => void
  onPdf: () => void
  onReopen: () => void
}

/** The «⋯» items of an order row: Ver pedido always, the rest by status and role. */
export function orderRowMenuItems(input: RowMenuInput): RowMenuItem[] {
  const delivered = input.status === 'Recogido'
  const items: RowMenuItem[] = [
    { key: 'view', label: 'Ver pedido', onSelect: input.onView },
  ]
  if (delivered) {
    items.push({
      key: 'pdf',
      label: input.pdfPending ? 'Generando…' : 'Nota PDF',
      disabled: input.pdfPending,
      onSelect: input.onPdf,
    })
  }
  if (delivered && input.canReopen) {
    items.push({
      key: 'reopen',
      label: 'Editar venta',
      destructive: true,
      disabled: input.reopenPending,
      onSelect: input.onReopen,
    })
  }
  return items
}

type RowKeyEvent = {
  key: string
  target: unknown
  currentTarget: unknown
  preventDefault: () => void
}

/** Enter/Space on the row itself opens the order; keys from inner controls are ignored. */
export function openOnRowKey(open: () => void) {
  return (event: RowKeyEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open()
  }
}

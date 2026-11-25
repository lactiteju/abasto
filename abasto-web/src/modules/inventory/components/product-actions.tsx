import { BoxesIcon, GaugeIcon, Trash2Icon } from 'lucide-react'

import { RowActionsMenu } from '#/components/row-actions-menu'
import type { RowMenuItem } from '#/components/row-actions-menu'
import { freePieces } from '#/modules/inventory/lib/loss-ledger'
import type { ProductStock } from '#/modules/inventory/services/stock-reads'

type ProductActionsProps = {
  row: ProductStock
  canManage: boolean
  /** Owner: may take damaged or expired pieces out. */
  canAdjustStock: boolean
  onLots: (row: ProductStock) => void
  onMinimum: (productId: string) => void
  onMerma: (row: ProductStock) => void
}

/** The «⋯» menu of a product row or card: Lotes, Mínimo and, with free pieces, Registrar merma. */
export function ProductActions({
  row,
  canManage,
  canAdjustStock,
  onLots,
  onMinimum,
  onMerma,
}: ProductActionsProps) {
  const items: Array<RowMenuItem> = [
    {
      key: 'lots',
      label: 'Lotes',
      icon: <BoxesIcon size={16} />,
      onSelect: () => onLots(row),
    },
  ]
  if (canManage) {
    items.push({
      key: 'minimum',
      label: 'Mínimo',
      icon: <GaugeIcon size={16} />,
      onSelect: () => onMinimum(row.productId),
    })
  }
  if (canAdjustStock && freePieces(row) > 0) {
    items.push({
      key: 'merma',
      label: 'Registrar merma',
      icon: <Trash2Icon size={16} />,
      destructive: true,
      onSelect: () => onMerma(row),
    })
  }
  return <RowActionsMenu label={`Acciones de ${row.name}`} items={items} />
}

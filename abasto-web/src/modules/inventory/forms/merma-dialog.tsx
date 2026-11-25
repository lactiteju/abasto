import { useState } from 'react'
import type { FormEvent } from 'react'

import { ProductImage } from '#/components/product-image'
import { cn } from '#/lib/utils/cn'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { Field, FieldInput } from '#/modules/inventory/components/form-controls'
import { FormError } from '#/modules/inventory/components/info-blocks'
import {
  DialogActions,
  InventoryDialog,
} from '#/modules/inventory/components/inventory-dialog'
import { useInventoryActions } from '#/modules/inventory/hooks/use-inventory-actions'
import {
  clampPieces,
  piecesAvailableLabel,
  typedPieces,
} from '#/modules/inventory/lib/merma-draft'

type Category = 'dañado' | 'caducado'

const categories: ReadonlyArray<{ value: Category; label: string }> = [
  { value: 'dañado', label: 'Dañado' },
  { value: 'caducado', label: 'Caducado' },
]

/** The product a merma is registered for. */
export type MermaProduct = {
  productId: string
  name: string
  sku: string
  imageUrl: string | null
  /** Base units on the shelf: not held by orders nor handed to riders. */
  available: number
}

type MermaDialogProps = {
  warehouseId: string
  product: MermaProduct
  onClose: () => void
}

/** Owner «Registrar merma»: damaged or expired pieces of one product leave the warehouse, earliest expiry first. */
export function MermaDialog({
  warehouseId,
  product,
  onClose,
}: MermaDialogProps) {
  const actions = useInventoryActions()
  const [typed, setTyped] = useState('')
  const [category, setCategory] = useState<Category>('dañado')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pieces = typedPieces(typed)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pieces) return setError('Indica cuántas piezas salen del inventario.')
    setError(null)
    const result = await actions.registerProductLoss({
      warehouseId,
      lines: [{ productId: product.productId, pieces }],
      category,
      note: note.trim() || undefined,
    })
    if (result) onClose()
  }

  return (
    <InventoryDialog
      title="Registrar merma"
      description="Las piezas salen del inventario; se toman primero las de caducidad más próxima."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#faf9f7]">
            <ProductImage
              src={product.imageUrl}
              name={product.name}
              className="size-full object-contain p-1 mix-blend-multiply"
              placeholderClassName="size-6"
            />
          </span>
          <span className="min-w-0">
            <strong className="block font-semibold">{product.name}</strong>
            <small className="block text-[#907e84]">{product.sku}</small>
          </span>
          <span className="ml-auto rounded-full bg-[#f4eef0] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#785e67]">
            {piecesAvailableLabel(product.available)}
          </span>
        </div>
        <Field label="Piezas">
          <FieldInput
            inputMode="numeric"
            placeholder="0"
            autoFocus
            value={typed}
            onChange={(event) =>
              setTyped(clampPieces(event.target.value, product.available))
            }
          />
        </Field>
        <div role="group" aria-label="Motivo" className="flex flex-wrap gap-2">
          {categories.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              className={cn(
                'min-h-[42px] rounded-full border px-4 text-sm',
                category === value
                  ? 'border-[#785e67] bg-[#785e67] text-white'
                  : 'border-[#eee7e0] bg-white text-[#785e67] hover:bg-[#f4eef0]',
              )}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Nota (opcional)">
          <FieldInput
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        {error && <FormError>{error}</FormError>}
        <DialogActions className="justify-end">
          <ActionButton type="button" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton tone="primary" type="submit" disabled={actions.pending}>
            {actions.pending ? 'Guardando…' : 'Registrar merma'}
          </ActionButton>
        </DialogActions>
      </form>
    </InventoryDialog>
  )
}

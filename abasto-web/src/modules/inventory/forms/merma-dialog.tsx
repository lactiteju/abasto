import { useState } from 'react'
import type { FormEvent } from 'react'

import { LargeDialog } from '#/components/large-dialog'
import { cn } from '#/lib/utils/cn'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { Field, FieldInput } from '#/modules/inventory/components/form-controls'
import { FormError } from '#/modules/inventory/components/info-blocks'
import { MermaTable } from '#/modules/inventory/components/merma-table'
import type { MermaProduct } from '#/modules/inventory/components/merma-table'
import { useInventoryActions } from '#/modules/inventory/hooks/use-inventory-actions'
import { mermaLines, summarizeMerma } from '#/modules/inventory/lib/merma-draft'
import type { PieceQuantities } from '#/modules/inventory/lib/merma-draft'

type Category = 'dañado' | 'caducado'

const categories: ReadonlyArray<{ value: Category; label: string }> = [
  { value: 'dañado', label: 'Dañado' },
  { value: 'caducado', label: 'Caducado' },
]

type MermaDialogProps = {
  warehouseId: string
  warehouseName: string
  products: ReadonlyArray<MermaProduct>
  onClose: () => void
}

/** Owner-only «Merma»: damaged or expired pieces of several products leave the warehouse at once. */
export function MermaDialog({
  warehouseId,
  warehouseName,
  products,
  onClose,
}: MermaDialogProps) {
  const actions = useInventoryActions()
  const [quantities, setQuantities] = useState<PieceQuantities>({})
  const [category, setCategory] = useState<Category>('dañado')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const lines = mermaLines(quantities)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lines.length) {
      return setError('Indica las piezas de al menos un producto.')
    }
    setError(null)
    const result = await actions.registerProductLoss({
      warehouseId,
      lines,
      category,
      note: note.trim() || undefined,
    })
    if (result) onClose()
  }

  return (
    <LargeDialog
      full
      title="Merma"
      description={`Piezas dañadas o caducadas de ${warehouseName}: salen del inventario, las de caducidad más próxima primero.`}
      onClose={onClose}
    >
      <MermaTable
        products={products}
        quantities={quantities}
        onChange={(productId, pieces) =>
          setQuantities((current) => ({ ...current, [productId]: pieces }))
        }
      />
      <form
        className="grid gap-3 border-t border-[#f4eee8] pt-4"
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
          <div
            role="group"
            aria-label="Motivo"
            className="flex flex-wrap gap-2"
          >
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
        </div>
        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm">{summarizeMerma(lines)}</strong>
          <div className="flex gap-3">
            <ActionButton type="button" onClick={onClose}>
              Cancelar
            </ActionButton>
            <ActionButton
              tone="primary"
              type="submit"
              disabled={actions.pending}
            >
              {actions.pending ? 'Guardando…' : 'Registrar merma'}
            </ActionButton>
          </div>
        </div>
      </form>
    </LargeDialog>
  )
}

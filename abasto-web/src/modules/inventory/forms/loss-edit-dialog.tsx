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
import type { LossCategory } from '#/modules/inventory/db/schema'
import { useInventoryActions } from '#/modules/inventory/hooks/use-inventory-actions'
import { lossEditDraft } from '#/modules/inventory/lib/loss-edits'
import { typedPieces } from '#/modules/inventory/lib/merma-draft'

const categories: ReadonlyArray<{ value: LossCategory; label: string }> = [
  { value: 'dañado', label: 'Dañado' },
  { value: 'caducado', label: 'Caducado' },
  { value: 'otro', label: 'Otro' },
]

/** The merma row being corrected or voided. */
export type LossTarget = {
  movementId: string
  productName: string
  sku: string
  imageUrl: string | null
  pieces: number
  reason: string
  lotCode: string
}

type LossDialogProps = { loss: LossTarget; onClose: () => void }

function LossProduct({ loss }: { loss: LossTarget }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#faf9f7]">
        <ProductImage
          src={loss.imageUrl}
          name={loss.productName}
          className="size-full object-contain p-1 mix-blend-multiply"
          placeholderClassName="size-6"
        />
      </span>
      <span className="min-w-0">
        <strong className="block font-semibold">{loss.productName}</strong>
        <small className="block text-[#907e84]">
          {loss.sku}
          {loss.lotCode && ` · Lote ${loss.lotCode}`}
        </small>
      </span>
    </div>
  )
}

/** Owner «Editar merma»: corrects pieces and motive; the lot gets back or gives the difference. */
export function LossEditDialog({ loss, onClose }: LossDialogProps) {
  const actions = useInventoryActions()
  const draft = lossEditDraft(loss.reason)
  const [typed, setTyped] = useState(String(loss.pieces))
  const [category, setCategory] = useState<LossCategory>(draft.category)
  const [note, setNote] = useState(draft.note)
  const [error, setError] = useState<string | null>(null)
  const pieces = typedPieces(typed)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pieces) return setError('Indica cuántas piezas fueron de merma.')
    if (category === 'otro' && !note.trim()) {
      return setError('Escribe el motivo de la merma.')
    }
    setError(null)
    const result = await actions.editLoss({
      movementId: loss.movementId,
      pieces,
      category,
      note: note.trim(),
    })
    if (result) onClose()
  }

  return (
    <InventoryDialog
      title="Editar merma"
      description="Si bajas las piezas, la diferencia regresa al mismo lote; si las subes, se toman de él."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <LossProduct loss={loss} />
        <Field label="Piezas">
          <FieldInput
            inputMode="numeric"
            placeholder="0"
            autoFocus
            value={typed}
            onChange={(event) =>
              setTyped(event.target.value.replace(/\D/g, '').slice(0, 9))
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
        <Field label={category === 'otro' ? 'Motivo' : 'Nota (opcional)'}>
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
            {actions.pending ? 'Guardando…' : 'Guardar cambios'}
          </ActionButton>
        </DialogActions>
      </form>
    </InventoryDialog>
  )
}

/** Owner «Anular merma»: confirms giving every piece back to its lot. */
export function LossVoidDialog({ loss, onClose }: LossDialogProps) {
  const actions = useInventoryActions()

  async function confirm() {
    const result = await actions.voidLoss(loss.movementId)
    if (result) onClose()
  }

  return (
    <InventoryDialog
      title="Anular merma"
      description={`${loss.pieces} ${loss.pieces === 1 ? 'pieza regresa' : 'piezas regresan'} al inventario y la merma sale de la lista.`}
      onClose={onClose}
    >
      <LossProduct loss={loss} />
      <DialogActions>
        <ActionButton type="button" onClick={onClose}>
          Conservar merma
        </ActionButton>
        <ActionButton
          tone="primary"
          type="button"
          disabled={actions.pending}
          onClick={() => void confirm()}
        >
          Anular merma
        </ActionButton>
      </DialogActions>
    </InventoryDialog>
  )
}

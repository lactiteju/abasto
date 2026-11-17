import { Trash2Icon, Undo2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { LargeDialog } from '#/components/large-dialog'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { Field, FieldInput } from '#/modules/inventory/components/form-controls'
import {
  FormError,
  SectionHelp,
} from '#/modules/inventory/components/info-blocks'
import { LoadProductsTable } from '#/modules/riders/components/load-products-table'
import { useRiderActions } from '#/modules/riders/hooks/use-rider-actions'
import type { AssignableProduct } from '#/modules/riders/lib/assign-draft'
import {
  assignableSuppliers,
  defaultSupplierId,
} from '#/modules/riders/lib/assign-supplier-filter'
import {
  describeQuantity,
  splitBoxes,
} from '#/modules/riders/lib/box-quantities'
import { editLoadInputFromDraft } from '#/modules/riders/lib/edit-load-draft'
import type { EditLoadLine } from '#/modules/riders/lib/edit-load-draft'
import { draftLines, summarizeLoad } from '#/modules/riders/lib/load-picker'
import type { LoadQuantities } from '#/modules/riders/lib/load-picker'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

type EditLoadDialogProps = {
  assignment: AssignmentDetail
  products: ReadonlyArray<AssignableProduct>
  onClose: () => void
}

function startingLines(assignment: AssignmentDetail): Array<EditLoadLine> {
  return assignment.lines.map((line) => {
    const { boxes, units } = splitBoxes(line.assignedQuantity, line.boxFactor)
    return {
      productId: line.productId,
      productName: line.productName,
      boxFactor: line.boxFactor,
      assignedQuantity: line.assignedQuantity,
      boxes: boxes > 0 ? String(boxes) : '',
      units: units > 0 ? String(units) : '',
      removed: false,
    }
  })
}

/** «Editar carga»: lower, remove, raise or add product on an «En ruta» assignment. */
export function EditLoadDialog({
  assignment,
  products,
  onClose,
}: EditLoadDialogProps) {
  const actions = useRiderActions()
  const [lines, setLines] = useState(() => startingLines(assignment))
  const [quantities, setQuantities] = useState<LoadQuantities>({})
  const initialSupplierId = useMemo(
    () => defaultSupplierId(assignableSuppliers(products)),
    [products],
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const added = draftLines(quantities)
  // Products already on the route are edited above, not added again.
  const onRoute = new Set(lines.map((line) => line.productId))
  const addable = products.filter((p) => !onRoute.has(p.productId))

  const patch = (index: number, change: Partial<EditLoadLine>) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    )

  async function submit() {
    const parsed = editLoadInputFromDraft(assignment.id, lines, added, products)
    if (!parsed.ok) return setError(parsed.message)
    setError(null)
    setPending(true)
    const result = await actions.editLoad(parsed.value)
    setPending(false)
    if (result) onClose()
  }

  return (
    <LargeDialog
      full
      title={`Editar carga de ${assignment.riderName}`}
      description="Baja o quita producto y regresa al almacén, o suma más. No se vende ni se cobra hasta liquidar."
      onClose={onClose}
    >
      <div className="grid gap-3">
        <SectionHelp className="my-0">
          Escribe la cantidad que debe llevar en total, en cajas, unidades o
          ambas. Para quitar un producto usa «Quitar».
        </SectionHelp>
        {lines.map((line, index) => {
          const available =
            products.find((p) => p.productId === line.productId)?.available ?? 0
          return (
            <div
              key={line.productId}
              className="grid items-end gap-3 rounded-[10px] border border-[#efe9e3] p-4 md:grid-cols-[minmax(0,1fr)_110px_110px_auto]"
            >
              <div className="flex min-w-0 flex-col gap-[7px]">
                <span
                  className={`text-sm font-[650] text-[#442460] ${line.removed ? 'line-through opacity-60' : ''}`}
                >
                  {line.productName}
                </span>
                <small className="text-[11px] font-normal text-[#9c888f]">
                  {line.removed
                    ? 'Se quitará y regresará al almacén.'
                    : `Lleva ${describeQuantity(line.assignedQuantity, line.boxFactor)} · caja = ${line.boxFactor} unidades · para sumar: ${describeQuantity(available, line.boxFactor)}`}
                </small>
              </div>
              <Field label="Cajas">
                <FieldInput
                  inputMode="numeric"
                  placeholder="0"
                  disabled={line.removed}
                  value={line.boxes}
                  onChange={(event) =>
                    patch(index, { boxes: event.target.value })
                  }
                />
              </Field>
              <Field label="Unidades">
                <FieldInput
                  inputMode="numeric"
                  placeholder="0"
                  disabled={line.removed}
                  value={line.units}
                  onChange={(event) =>
                    patch(index, { units: event.target.value })
                  }
                />
              </Field>
              <ActionButton
                type="button"
                aria-label={`${line.removed ? 'Deshacer' : 'Quitar'} ${line.productName}`}
                className="px-3"
                onClick={() => patch(index, { removed: !line.removed })}
              >
                {line.removed ? (
                  <Undo2Icon size={17} />
                ) : (
                  <Trash2Icon size={17} />
                )}
                {line.removed ? 'Deshacer' : 'Quitar'}
              </ActionButton>
            </div>
          )
        })}
        <SectionHelp className="my-0">
          Agrega otros productos a este reparto:
        </SectionHelp>
      </div>
      <LoadProductsTable
        products={addable}
        allProducts={products}
        quantities={quantities}
        initialSupplierId={initialSupplierId}
        onChange={(productId, change) =>
          setQuantities((current) => ({
            ...current,
            [productId]: {
              boxes: current[productId]?.boxes ?? '',
              units: current[productId]?.units ?? '',
              ...change,
            },
          }))
        }
      />
      <form
        className="grid gap-3 border-t border-[#f4eee8] pt-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm">
            {added.length
              ? `Por agregar: ${summarizeLoad(added)}`
              : 'Sin productos por agregar'}
          </strong>
          <div className="flex gap-3">
            <ActionButton type="button" onClick={onClose}>
              Cancelar
            </ActionButton>
            <ActionButton tone="primary" type="submit" disabled={pending}>
              Guardar cambios
            </ActionButton>
          </div>
        </div>
      </form>
    </LargeDialog>
  )
}

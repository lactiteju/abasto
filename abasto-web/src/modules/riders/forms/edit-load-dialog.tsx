import { PlusIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ProductPicker } from '#/components/product-picker'
import { SupplierSelect } from '#/components/supplier-select'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { Field, FieldInput } from '#/modules/inventory/components/form-controls'
import {
  FormError,
  SectionHelp,
} from '#/modules/inventory/components/info-blocks'
import {
  DialogActions,
  InventoryDialog,
} from '#/modules/inventory/components/inventory-dialog'
import { useRiderActions } from '#/modules/riders/hooks/use-rider-actions'
import type {
  AssignableProduct,
  AssignDraftLine,
} from '#/modules/riders/lib/assign-draft'
import {
  assignableSuppliers,
  defaultSupplierId,
  filterBySupplier,
} from '#/modules/riders/lib/assign-supplier-filter'
import {
  describeQuantity,
  splitBoxes,
} from '#/modules/riders/lib/box-quantities'
import { editLoadInputFromDraft } from '#/modules/riders/lib/edit-load-draft'
import type { EditLoadLine } from '#/modules/riders/lib/edit-load-draft'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

type EditLoadDialogProps = {
  assignment: AssignmentDetail
  products: ReadonlyArray<AssignableProduct>
  onClose: () => void
}

const emptyLine = (): AssignDraftLine => ({
  productId: '',
  boxes: '',
  units: '',
})

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
  const idPrefix = useId()
  const [lines, setLines] = useState(() => startingLines(assignment))
  const [added, setAdded] = useState<Array<AssignDraftLine>>([])
  const suppliers = useMemo(() => assignableSuppliers(products), [products])
  const [supplierId, setSupplierId] = useState(() =>
    defaultSupplierId(suppliers),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const patch = (index: number, change: Partial<EditLoadLine>) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    )
  const patchAdded = (index: number, change: Partial<AssignDraftLine>) =>
    setAdded(
      added.map((line, i) => (i === index ? { ...line, ...change } : line)),
    )
  const onRoute = new Set(lines.map((line) => line.productId))

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
    <InventoryDialog
      title={`Editar carga de ${assignment.riderName}`}
      description="Baja o quita producto y regresa al almacén, o suma más. No se vende ni se cobra hasta liquidar."
      onClose={onClose}
      size="count"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
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
        <Field label="Proveedor">
          <SupplierSelect
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
          />
        </Field>
        {added.map((line, index) => {
          const product = products.find((p) => p.productId === line.productId)
          const taken = new Set([
            ...onRoute,
            ...added.filter((_, i) => i !== index).map((l) => l.productId),
          ])
          return (
            <div
              key={index}
              className="grid items-end gap-3 rounded-[10px] border border-[#efe9e3] p-4 md:grid-cols-[minmax(0,1fr)_110px_110px_auto]"
            >
              <div className="flex min-w-0 flex-col gap-[7px]">
                <Field label="Producto">
                  <ProductPicker
                    label="Producto"
                    value={line.productId}
                    products={filterBySupplier(
                      products,
                      supplierId,
                      added.map((l) => l.productId),
                    )
                      .filter((p) => !taken.has(p.productId))
                      .map((p) => ({
                        id: p.productId,
                        name: p.name,
                        sku: p.sku ?? '',
                      }))}
                    onChange={(productId) => patchAdded(index, { productId })}
                  />
                </Field>
                {product && (
                  <small
                    id={`${idPrefix}-${index}-hint`}
                    className="text-[11px] font-normal text-[#9c888f]"
                  >
                    {`Caja = ${product.boxFactor} unidades · disponibles: ${describeQuantity(product.available, product.boxFactor)}`}
                  </small>
                )}
              </div>
              <Field label="Cajas">
                <FieldInput
                  inputMode="numeric"
                  placeholder="0"
                  value={line.boxes}
                  onChange={(event) =>
                    patchAdded(index, { boxes: event.target.value })
                  }
                />
              </Field>
              <Field label="Unidades">
                <FieldInput
                  inputMode="numeric"
                  placeholder="0"
                  value={line.units}
                  onChange={(event) =>
                    patchAdded(index, { units: event.target.value })
                  }
                />
              </Field>
              <ActionButton
                type="button"
                aria-label="Quitar producto"
                className="px-3"
                onClick={() => setAdded(added.filter((_, i) => i !== index))}
              >
                <Trash2Icon size={17} />
              </ActionButton>
            </div>
          )
        })}
        <div>
          <ActionButton
            type="button"
            disabled={onRoute.size + added.length >= products.length}
            onClick={() => setAdded([...added, emptyLine()])}
          >
            <PlusIcon size={17} />
            Agregar producto
          </ActionButton>
        </div>
        {error && <FormError>{error}</FormError>}
        <DialogActions>
          <ActionButton type="button" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton tone="primary" type="submit" disabled={pending}>
            Guardar carga
          </ActionButton>
        </DialogActions>
      </form>
    </InventoryDialog>
  )
}

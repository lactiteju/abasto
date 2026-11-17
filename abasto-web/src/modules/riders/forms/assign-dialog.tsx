import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ProductPicker } from '#/components/product-picker'
import { SupplierSelect } from '#/components/supplier-select'
import { ActionButton } from '#/modules/inventory/components/action-button'
import {
  Field,
  FieldInput,
  FieldSelect,
} from '#/modules/inventory/components/form-controls'
import {
  FormError,
  SectionHelp,
  WarningInline,
} from '#/modules/inventory/components/info-blocks'
import {
  DialogActions,
  InventoryDialog,
} from '#/modules/inventory/components/inventory-dialog'
import { useRiderActions } from '#/modules/riders/hooks/use-rider-actions'
import { assignInputFromDraft } from '#/modules/riders/lib/assign-draft'
import type {
  AssignableProduct,
  AssignDraftLine,
} from '#/modules/riders/lib/assign-draft'
import {
  assignableSuppliers,
  defaultSupplierId,
  filterBySupplier,
} from '#/modules/riders/lib/assign-supplier-filter'
import { describeQuantity } from '#/modules/riders/lib/box-quantities'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import type { Rider } from '#/modules/riders/services/riders'

type AssignDialogProps = {
  /** Active riders without an assignment on the road. */
  riders: ReadonlyArray<Rider>
  products: ReadonlyArray<AssignableProduct>
  onClose: () => void
  /** Rider chosen when it opens (e.g. preparing their next assignment). */
  initialRiderId?: string
  /** Lines the form starts with; editable and removable. */
  initialLines?: ReadonlyArray<AssignDraftLine>
  /** Heads-up shown above the lines (what was capped or left out). */
  notices?: ReadonlyArray<string>
  /** «Recargar»: add to this «En ruta» assignment instead of creating one. */
  recharge?: AssignmentDetail
}

const emptyLine = (): AssignDraftLine => ({
  productId: '',
  boxes: '',
  units: '',
})

/** Hands product to a rider: pick the rider, then boxes and/or units per product. */
export function AssignDialog({
  riders,
  products,
  onClose,
  initialRiderId,
  initialLines,
  notices = [],
  recharge,
}: AssignDialogProps) {
  const actions = useRiderActions()
  const idPrefix = useId()
  const [riderId, setRiderId] = useState(
    recharge?.riderId ?? initialRiderId ?? riders.at(0)?.id ?? '',
  )
  const [lines, setLines] = useState<Array<AssignDraftLine>>(
    initialLines?.length ? [...initialLines] : [emptyLine()],
  )
  const suppliers = useMemo(() => assignableSuppliers(products), [products])
  const [supplierId, setSupplierId] = useState(() =>
    defaultSupplierId(suppliers),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const patch = (index: number, change: Partial<AssignDraftLine>) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    )

  async function submit() {
    const parsed = assignInputFromDraft(riderId, lines, products)
    if (!parsed.ok) return setError(parsed.message)
    setError(null)
    setPending(true)
    const result = recharge
      ? await actions.recharge({
          assignmentId: recharge.id,
          lines: parsed.value.lines,
        })
      : await actions.assign(parsed.value)
    setPending(false)
    if (result) onClose()
  }

  return (
    <InventoryDialog
      title={
        recharge ? `Recargar reparto de ${recharge.riderName}` : 'Nuevo reparto'
      }
      description={
        recharge
          ? 'El producto se aparta del almacén y se suma a este mismo reparto. No se vende ni se cobra hasta liquidar.'
          : 'El producto se aparta del almacén y queda en ruta. No se vende ni se cobra hasta liquidar.'
      }
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
        {recharge ? (
          <p className="flex flex-col gap-[7px] text-[13px] font-medium text-[#513f45]">
            Repartidor
            <span className="text-sm font-[650] text-[#442460]">
              {recharge.riderName}
            </span>
          </p>
        ) : (
          <Field label="Repartidor">
            <FieldSelect
              value={riderId}
              onChange={(event) => setRiderId(event.target.value)}
            >
              <option value="">Elige al repartidor</option>
              {riders.map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              ))}
            </FieldSelect>
          </Field>
        )}
        {notices.map((notice) => (
          <WarningInline key={notice} className="my-0">
            {notice}
          </WarningInline>
        ))}
        <SectionHelp className="my-0">
          Escribe cajas, unidades o ambas, por ejemplo 40 cajas y 20 unidades.
        </SectionHelp>
        <Field label="Proveedor">
          <SupplierSelect
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
          />
        </Field>
        {lines.map((line, index) => {
          const product = products.find((p) => p.productId === line.productId)
          const taken = new Set(
            lines.filter((_, i) => i !== index).map((l) => l.productId),
          )
          const hintId = `${idPrefix}-${index}-hint`
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
                      lines.map((l) => l.productId),
                    )
                      .filter((p) => !taken.has(p.productId))
                      .map((p) => ({
                        id: p.productId,
                        name: p.name,
                        sku: p.sku ?? '',
                      }))}
                    onChange={(productId) => patch(index, { productId })}
                  />
                </Field>
                {product && (
                  <small
                    id={hintId}
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
                    patch(index, { boxes: event.target.value })
                  }
                />
              </Field>
              <Field label="Unidades">
                <FieldInput
                  inputMode="numeric"
                  placeholder="0"
                  value={line.units}
                  onChange={(event) =>
                    patch(index, { units: event.target.value })
                  }
                />
              </Field>
              {lines.length > 1 && (
                <ActionButton
                  type="button"
                  aria-label="Quitar producto"
                  className="px-3"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  <Trash2Icon size={17} />
                </ActionButton>
              )}
            </div>
          )
        })}
        <div>
          <ActionButton
            type="button"
            disabled={lines.length >= products.length}
            onClick={() => setLines([...lines, emptyLine()])}
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
            {recharge ? 'Agregar a la ruta' : 'Asignar reparto'}
          </ActionButton>
        </DialogActions>
      </form>
    </InventoryDialog>
  )
}

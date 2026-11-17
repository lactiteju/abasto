import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { SearchBox } from '#/components/search-box'
import { SupplierSelect } from '#/components/supplier-select'

import { ActionButton } from '#/modules/counter/components/action-button'
import {
  CellNote,
  DataTable,
  TableWrap,
  Td,
  Th,
} from '#/modules/counter/components/data-table'
import { FieldInput } from '#/modules/counter/components/form-controls'
import { useOrderActions } from '#/modules/counter/hooks/use-order-actions'
import { typeLineQuantity } from '#/modules/counter/lib/order-draft'
import type { DraftLine } from '#/modules/counter/lib/order-draft'
import {
  draftToEdit,
  initialEdits,
  isChanged,
  isRemoved,
  removeEdit,
  restoreEdit,
  setEditQuantity,
  stockBalance,
} from '#/modules/counter/lib/order-edit-draft'
import {
  findStockShortages,
  stockShortageMessage,
} from '#/modules/counter/lib/order-stock'
import {
  filterSellable,
  groupSellable,
  productAvailabilityLabel,
  sellableSuppliers,
} from '#/modules/counter/lib/sellable'
import type { SellableOption } from '#/modules/counter/lib/sellable'
import type { OrderDetail } from '#/modules/orders/services/order-reads'

type OrderAddProductsProps = {
  order: OrderDetail
  sellable: Array<SellableOption>
  onSaved: (order: OrderDetail) => void
  onCancel: () => void
}

/**
 * Edit mode of a reserved order: change the boxes or pieces of each line
 * (lower, raise or remove it) and search other products to add. Saving
 * releases or reserves the difference in one step.
 */
export function OrderAddProducts({
  order,
  sellable,
  onSaved,
  onCancel,
}: OrderAddProductsProps) {
  const actions = useOrderActions()
  const [edits, setEdits] = useState(() => initialEdits(order.lines))
  const [lines, setLines] = useState<Array<DraftLine>>([])
  const [query, setQuery] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const lineOf = new Map(lines.map((line) => [line.presentationId, line]))
  const inOrder = new Map(
    order.lines.map((line) => [line.presentationId, line.quantity]),
  )
  // Units freed by lowering lines can cover what is added; raises use stock too.
  const balance = stockBalance(edits)
  const adjusted = new Map(
    sellable.map((option) => [
      option.presentationId,
      {
        ...option,
        availableBase:
          option.availableBase + (balance.get(option.productId) ?? 0),
      },
    ]),
  )
  const shortages = findStockShortages(lines, adjusted)
  const availableOf = new Map(
    sellable.map((option) => [option.productId, option.availableBase]),
  )
  const raisedShort = (productId: string) =>
    (availableOf.get(productId) ?? 0) + (balance.get(productId) ?? 0) < 0
  const suppliers = useMemo(() => sellableSuppliers(sellable), [sellable])
  const products = useMemo(() => groupSellable(sellable), [sellable])
  const visible = filterSellable(products, { query, supplierId })

  function quantityInput(
    option: SellableOption | null,
    label: string,
    blocked: boolean,
    productName: string,
  ) {
    return (
      <label className="grid gap-1 text-xs text-[#907e84]">
        {label}
        <FieldInput
          inputMode="numeric"
          aria-label={`Agregar ${label.toLowerCase()} de ${productName}`}
          placeholder="0"
          className="w-20"
          disabled={!option || blocked || inOrder.has(option.presentationId)}
          value={
            option ? (lineOf.get(option.presentationId)?.quantity ?? '') : ''
          }
          onChange={(event) =>
            option &&
            setLines((current) =>
              typeLineQuantity(
                current,
                option.presentationId,
                event.target.value,
              ),
            )
          }
        />
        {option && inOrder.has(option.presentationId) && (
          <span>En el pedido: {inOrder.get(option.presentationId)}</span>
        )}
      </label>
    )
  }

  async function save() {
    const parsed = draftToEdit(edits, lines)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    const result = await actions.editOrder(
      order.id,
      parsed.value.changes,
      parsed.value.add,
    )
    if (result) onSaved(result.data)
  }

  return (
    <section
      aria-label="Editar pedido"
      className="grid gap-3 rounded-xl border border-[#f1ebe5] p-3"
    >
      <p className="text-sm">
        Cambia las cajas o piezas de cada línea (con 0 o «Quitar» sale del
        pedido) o agrega otro producto con el buscador. Lo que ya está en el
        pedido conserva su precio; un producto nuevo se cotiza al precio actual.
      </p>
      <TableWrap className="rounded-xl border border-[#f1ebe5]">
        <DataTable>
          <thead>
            <tr>
              <Th>En el pedido</Th>
              <Th>Cantidad</Th>
              <Th>
                <span className="sr-only">Quitar</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {edits.map((edit, index) => {
              const detail = order.lines[index]
              const removed = isRemoved(edit)
              return (
                <tr key={edit.presentationId}>
                  <Td>
                    <span className={removed ? 'line-through' : undefined}>
                      {detail.productName}
                    </span>
                    <CellNote>{detail.presentationName}</CellNote>
                    {removed && (
                      <CellNote>Se quitará del pedido al guardar.</CellNote>
                    )}
                    {raisedShort(edit.productId) && !removed && (
                      <p role="alert" className="mt-1 text-xs text-[#a1372e]">
                        No hay suficiente existencia disponible para subir esta
                        cantidad.
                      </p>
                    )}
                  </Td>
                  <Td>
                    <FieldInput
                      inputMode="numeric"
                      aria-label={`Cantidad de ${detail.productName} (${detail.presentationName})`}
                      className="w-20"
                      value={edit.quantity}
                      onChange={(event) =>
                        setEdits((current) =>
                          setEditQuantity(
                            current,
                            edit.presentationId,
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </Td>
                  <Td>
                    {removed || isChanged(edit) ? (
                      <ActionButton
                        disabled={actions.pending}
                        onClick={() =>
                          setEdits((current) =>
                            restoreEdit(current, edit.presentationId),
                          )
                        }
                      >
                        Deshacer
                      </ActionButton>
                    ) : null}
                    {!removed && (
                      <ActionButton
                        disabled={actions.pending}
                        aria-label={`Quitar ${detail.productName} (${detail.presentationName})`}
                        onClick={() =>
                          setEdits((current) =>
                            removeEdit(current, edit.presentationId),
                          )
                        }
                      >
                        Quitar
                      </ActionButton>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </TableWrap>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1">
          <SearchBox
            label="Buscar producto"
            placeholder="Buscar por nombre o SKU"
            value={query}
            onChange={setQuery}
          />
        </div>
        {suppliers.length > 0 && (
          <SupplierSelect
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
          />
        )}
      </div>
      <TableWrap className="max-h-[22rem] overflow-y-auto rounded-xl border border-[#f1ebe5]">
        <DataTable>
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Producto</Th>
              <Th>Agregar otro producto</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => {
              const options = [product.box, product.piece].flatMap((option) =>
                option ? [option] : [],
              )
              const shortage = options
                .map((option) => shortages.get(option.presentationId))
                .find(Boolean)
              const outOfStock = product.availableBase === 0
              return (
                <tr key={product.productId}>
                  <Td>
                    <strong className="font-semibold">
                      {product.productName}
                    </strong>
                    <CellNote>
                      {product.sku}
                      {product.supplierName && ` · ${product.supplierName}`}
                    </CellNote>
                    <CellNote>{productAvailabilityLabel(product)}</CellNote>
                    {shortage && (
                      <p role="alert" className="mt-1 text-xs text-[#a1372e]">
                        {stockShortageMessage(shortage)}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <span className="flex gap-2">
                      {quantityInput(
                        product.box,
                        'Cajas',
                        outOfStock,
                        product.productName,
                      )}
                      {quantityInput(
                        product.piece,
                        'Piezas',
                        outOfStock,
                        product.productName,
                      )}
                    </span>
                  </Td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <Td colSpan={2} className="text-center text-[#907e84]">
                  Sin productos que coincidan
                </Td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </TableWrap>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          tone="primary"
          disabled={
            actions.pending ||
            (lines.length === 0 && !edits.some(isChanged)) ||
            shortages.size > 0 ||
            edits.some((e) => !isRemoved(e) && raisedShort(e.productId))
          }
          onClick={save}
        >
          {actions.pending ? 'Guardando…' : 'Guardar cambios'}
        </ActionButton>
        <ActionButton disabled={actions.pending} onClick={onCancel}>
          Descartar cambios
        </ActionButton>
      </div>
    </section>
  )
}

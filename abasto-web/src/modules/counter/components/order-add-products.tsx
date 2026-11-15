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
import {
  draftToAddLines,
  typeLineQuantity,
} from '#/modules/counter/lib/order-draft'
import type { DraftLine } from '#/modules/counter/lib/order-draft'
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
 * Edit mode of a reserved order: search products and type the boxes or pieces
 * to ADD (to an existing line or as a new one). Saving reserves them.
 */
export function OrderAddProducts({
  order,
  sellable,
  onSaved,
  onCancel,
}: OrderAddProductsProps) {
  const actions = useOrderActions()
  const [lines, setLines] = useState<Array<DraftLine>>([])
  const [query, setQuery] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const optionOf = new Map(
    sellable.map((option) => [option.presentationId, option]),
  )
  const lineOf = new Map(lines.map((line) => [line.presentationId, line]))
  const inOrder = new Map(
    order.lines.map((line) => [line.presentationId, line.quantity]),
  )
  const shortages = findStockShortages(lines, optionOf)
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
          disabled={!option || blocked}
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
    const parsed = draftToAddLines(lines)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    const result = await actions.addToOrder(order.id, parsed.value)
    if (result) onSaved(result.data)
  }

  return (
    <section
      aria-label="Agregar productos"
      className="grid gap-3 rounded-xl border border-[#f1ebe5] p-3"
    >
      <p className="text-sm">
        Escribe las cajas o piezas que quieres <strong>agregar</strong>. Lo que
        ya está en el pedido conserva su precio; un producto nuevo se cotiza al
        precio actual.
      </p>
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
              <Th>Agregar</Th>
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
          disabled={actions.pending || lines.length === 0 || shortages.size > 0}
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

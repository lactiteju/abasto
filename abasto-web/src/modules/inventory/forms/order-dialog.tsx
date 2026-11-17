import { useEffect, useMemo, useState } from 'react'

import { ActionButton } from '#/modules/inventory/components/action-button'
import {
  Field,
  FieldInput,
  FieldSelect,
  FormGrid,
} from '#/modules/inventory/components/form-controls'
import { FormError } from '#/modules/inventory/components/info-blocks'
import {
  DialogActions,
  InventoryDialog,
} from '#/modules/inventory/components/inventory-dialog'
import {
  ListBody,
  ListCell,
  ListHead,
  ListPanel,
  ListRow,
  ListTable,
} from '#/modules/inventory/components/list-panel'
import { SearchBox } from '#/components/search-box'
import { OrderTable } from '#/modules/inventory/forms/order-table'
import { useInventoryActions } from '#/modules/inventory/hooks/use-inventory-actions'
import { formatCents } from '#/modules/inventory/lib/cents'
import {
  discountIssue,
  discountsInput,
  discountTotalCents,
  orderTotalsText,
  toggleDiscount,
} from '#/modules/inventory/lib/order-discounts'
import {
  boxCountLabel,
  onlyWithBoxes,
  sortBelowMinimumFirst,
} from '#/modules/inventory/lib/order-rows'
import type { OrderStock } from '#/modules/inventory/lib/order-rows'
import {
  orderInputFromDraft,
  orderTotalCents,
  supplierProducts,
} from '#/modules/inventory/lib/supplier-order-draft'
import type { OrderDraft } from '#/modules/inventory/lib/supplier-order-draft'
import {
  discountReopenNote,
  draftFromOrder,
  editInputFromDraft,
  productsForEdit,
} from '#/modules/inventory/lib/supplier-order-edit-draft'
import type { SupplierOrder } from '#/modules/inventory/services/supplier-orders'
import type {
  CatalogProduct,
  CatalogSupplier,
} from '#/modules/catalog/lib/catalog-types'
import type { PendingBalance } from '#/modules/inventory/services/supplier-pendings'
import type { WarehouseOption } from '#/modules/inventory/types/stock'
import { WarehousePricesDialog } from '#/modules/pricing/forms/warehouse-prices-dialog'
import { hasWarehouseChoice } from '#/modules/warehouses/lib/warehouse-choice'

type OrderDialogProps = {
  /** Warehouses the actor manages. */
  warehouses: ReadonlyArray<WarehouseOption>
  initialWarehouseId: string
  suppliers: ReadonlyArray<CatalogSupplier>
  products: ReadonlyArray<CatalogProduct>
  /** Whether the actor may edit catalog products (owner); a manager of the receiving warehouse edits its prices and costs too. */
  canEditProducts: boolean
  /** Open balances that can be discounted ("Por reponer" and "Descuentos a favor") of every supplier; the dialog keeps the chosen supplier's. */
  discountable: ReadonlyArray<PendingBalance>
  /** Product to start from, e.g. a low-stock alert: picks its supplier and finds it. */
  initialProductId?: string
  /** An order in «Pedido» to edit: its lines are prefilled, the supplier is fixed and the folio kept. */
  order?: SupplierOrder
  onClose: () => void
}

/** Order to a supplier: its products and the boxes of each; price, discount and promotion come from the catalog. */
export function OrderDialog({
  warehouses,
  initialWarehouseId,
  suppliers,
  products,
  canEditProducts,
  discountable,
  initialProductId,
  order,
  onClose,
}: OrderDialogProps) {
  const actions = useInventoryActions()
  const initialProduct = products.find(({ id }) => id === initialProductId)
  const [draft, setDraft] = useState<OrderDraft>(() =>
    order
      ? draftFromOrder(order)
      : {
          supplierId: initialProduct?.supplierId ?? '',
          warehouseId: initialWarehouseId,
          expectedOn: '',
          boxes: {},
        },
  )
  const [editingId, setEditingId] = useState<string>()
  const [query, setQuery] = useState(initialProduct?.name ?? '')
  const [onlyBoxes, setOnlyBoxes] = useState(false)
  // Undefined while loading, so rows neither warn nor show stock until they arrive.
  const [standard, setStandard] = useState<Record<string, number>>()
  const [stock, setStock] = useState<Record<string, OrderStock>>()
  const [error, setError] = useState<string | null>(null)
  // Row the last save failed on; `request` re-triggers the scroll on each attempt.
  const [failed, setFailed] = useState<{ productId: string; request: number }>()
  const [reloadStandard, setReloadStandard] = useState(0)
  // Pending ids of the balances to discount; chosen only until the order is registered.
  const [discounted, setDiscounted] = useState<ReadonlyArray<string>>([])

  // Folio the order would get; undefined while loading or when no supplier is chosen.
  const [folio, setFolio] = useState<string>()

  // The folio belongs to the supplier: refresh it when the supplier changes.
  useEffect(() => {
    let current = true
    setFolio(undefined)
    if (draft.supplierId && !order) {
      void actions
        .loadFolioPreview(draft.supplierId, draft.warehouseId)
        .then((next) => {
          if (current) setFolio(next)
        })
    }
    return () => {
      current = false
    }
  }, [draft.supplierId, draft.warehouseId])

  // Standard prices are shown read-only; reload them for the receiving warehouse.
  useEffect(() => {
    let current = true
    setStandard(undefined)
    void actions.loadStandardPrices(draft.warehouseId).then((prices) => {
      if (current) setStandard(prices)
    })
    return () => {
      current = false
    }
  }, [draft.warehouseId, reloadStandard])

  // Stock and minimums of the receiving warehouse; reloaded when it changes.
  useEffect(() => {
    let current = true
    setStock(undefined)
    void actions.loadWarehouseStock(draft.warehouseId).then((loaded) => {
      if (current) setStock(loaded)
    })
    return () => {
      current = false
    }
  }, [draft.warehouseId])

  // Editing: lines already on the order keep their frozen terms in the figures.
  const catalog = useMemo(
    () => (order ? productsForEdit(products, order.lines) : products),
    [products, order],
  )
  const own = useMemo(
    () => supplierProducts(catalog, draft.supplierId, ''),
    [catalog, draft.supplierId],
  )
  const visible = useMemo(() => {
    const matching = supplierProducts(catalog, draft.supplierId, query)
    const shown = onlyBoxes ? onlyWithBoxes(matching, draft.boxes) : matching
    return sortBelowMinimumFirst(shown, stock)
  }, [catalog, draft.supplierId, draft.boxes, query, onlyBoxes, stock])
  const total = orderTotalCents(own, draft)
  const owedHere = useMemo(
    () => discountable.filter((row) => row.supplierId === draft.supplierId),
    [discountable, draft.supplierId],
  )
  // Editing keeps the discounts already applied; the server reopens the ones that no longer fit.
  const discountCents = order
    ? order.discountCents
    : discountTotalCents(owedHere, discounted)
  const tooMuch = order ? null : discountIssue(total, discountCents)
  const reopenNote = order ? discountReopenNote(discountCents, total) : null

  /** Brings the failing product on screen: clears the filters that hide it, then the table scrolls to it. */
  function showFailedRow(productId: string) {
    if (!visible.some(({ id }) => id === productId)) {
      setQuery('')
      setOnlyBoxes(false)
    }
    setFailed((current) => ({
      productId,
      request: (current?.request ?? 0) + 1,
    }))
  }

  async function submit() {
    if (order) {
      const edited = editInputFromDraft(order.id, draft, own)
      if (!edited.ok) {
        if ('productId' in edited) showFailedRow(edited.productId)
        return setError(edited.message)
      }
      setFailed(undefined)
      setError(null)
      if (await actions.editOrder(edited.value)) onClose()
      return
    }
    const parsed = orderInputFromDraft(draft, own)
    if (!parsed.ok) {
      if ('productId' in parsed) showFailedRow(parsed.productId)
      return setError(parsed.message)
    }
    setFailed(undefined)
    if (tooMuch) return setError(tooMuch)
    setError(null)
    const chosen = discountsInput(discounted)
    const saved = await actions.createOrder(
      chosen ? { ...parsed.value, discounts: chosen } : parsed.value,
    )
    if (saved) onClose()
  }

  const editing = products.find(({ id }) => id === editingId)
  // The owner, or the manager of the receiving warehouse, fixes costs and prices without leaving the order.
  const canEditPrices =
    canEditProducts ||
    warehouses.some(
      ({ id, canManage }) => id === draft.warehouseId && canManage,
    )

  return (
    <>
      <InventoryDialog
        title={order ? 'Editar pedido' : 'Nuevo pedido al proveedor'}
        eyebrow={order ? order.supplierName.toUpperCase() : 'POR RECIBIR'}
        description={
          order
            ? `${order.code} · Sube, baja o quita cajas y agrega otros productos del proveedor. Conserva su folio. Para dejarlo sin productos usa «Cancelar pedido».`
            : 'Elige el proveedor y las cajas de cada producto. No mueve existencias hasta que lo recibas.'
        }
        size="wide"
        onClose={onClose}
        footer={
          <>
            {(error ?? tooMuch) && (
              <FormError>{error ?? tooMuch ?? ''}</FormError>
            )}
            {reopenNote && (
              <p className="text-xs text-[#7a5a14]">{reopenNote}</p>
            )}
            <DialogActions className="mt-0 border-t-0 pt-0">
              <strong className="text-base text-[#5f4a51]">
                {orderTotalsText(total, discountCents)}
              </strong>
              <span className="flex gap-3">
                <ActionButton type="button" onClick={onClose}>
                  Cancelar
                </ActionButton>
                <ActionButton
                  tone="primary"
                  type="submit"
                  form="order-form"
                  disabled={actions.pending}
                >
                  {actions.pending
                    ? 'Guardando…'
                    : order
                      ? 'Guardar cambios'
                      : 'Registrar pedido'}
                </ActionButton>
              </span>
            </DialogActions>
          </>
        }
      >
        <form
          id="order-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <FormGrid>
            <Field label="Proveedor">
              <FieldSelect
                disabled={Boolean(order)}
                value={draft.supplierId}
                onChange={(event) => {
                  setQuery('')
                  setDiscounted([])
                  setDraft({
                    ...draft,
                    supplierId: event.target.value,
                    boxes: {},
                  })
                }}
              >
                <option value="">Selecciona un proveedor</option>
                {suppliers
                  .filter((supplier) => supplier.active)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </FieldSelect>
            </Field>
            {!order && hasWarehouseChoice(warehouses) && (
              <Field label="Almacén que recibe">
                <FieldSelect
                  value={draft.warehouseId}
                  onChange={(event) =>
                    setDraft({ ...draft, warehouseId: event.target.value })
                  }
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
            )}
            <Field label="Fecha esperada de entrega (opcional)">
              <FieldInput
                type="date"
                disabled={Boolean(order)}
                value={draft.expectedOn}
                onChange={(event) =>
                  setDraft({ ...draft, expectedOn: event.target.value })
                }
              />
            </Field>
          </FormGrid>
          <Field label="Folio">
            <FieldInput
              readOnly
              aria-readonly
              value={
                order
                  ? order.code
                  : !draft.supplierId
                    ? 'Elige un proveedor para ver su folio'
                    : (folio ?? 'Calculando…')
              }
              className="text-[#907e84]"
            />
            {draft.supplierId && folio && (
              <p className="mt-1 text-xs text-[#9c898f]">
                Se confirma al guardar el pedido.
              </p>
            )}
          </Field>
          {draft.supplierId ? (
            <>
              {!order && owedHere.length > 0 && (
                <section className="grid gap-2.5">
                  <h3 className="text-sm font-[650] text-[#5f4a51]">
                    Faltantes y descuentos a favor
                  </h3>
                  <p className="text-xs text-[#9c898f]">
                    Descontar cierra el saldo: su valor se resta del pago de
                    este pedido y, si es un faltante, las cajas ya no se
                    esperan. Se aplica al registrar el pedido.
                  </p>
                  <ListPanel>
                    <ListTable>
                      <ListHead>
                        {['Producto', 'Pedido', 'Debe', 'Valor', '']}
                      </ListHead>
                      <ListBody>
                        {owedHere.map((row) => {
                          const chosen = discounted.includes(row.pendingId)
                          return (
                            <ListRow key={row.pendingId}>
                              <ListCell>
                                <strong>{row.productName}</strong>
                                <small className="block text-[#907e84]">
                                  {row.kind === 'credit'
                                    ? 'Descuento a favor'
                                    : 'Faltante'}
                                </small>
                              </ListCell>
                              <ListCell>{row.originCode}</ListCell>
                              <ListCell>
                                {boxCountLabel(row.owedBoxes, row.boxFactor)}
                              </ListCell>
                              <ListCell>
                                {formatCents(row.owedValueCents)}
                              </ListCell>
                              <ListCell>
                                <span className="flex justify-end">
                                  <ActionButton
                                    type="button"
                                    aria-pressed={chosen}
                                    className="min-h-9 px-3"
                                    tone={chosen ? 'primary' : 'secondary'}
                                    onClick={() =>
                                      setDiscounted((current) =>
                                        toggleDiscount(current, row.pendingId),
                                      )
                                    }
                                  >
                                    {chosen
                                      ? 'Descontado · Deshacer'
                                      : 'Descontar'}
                                  </ActionButton>
                                </span>
                              </ListCell>
                            </ListRow>
                          )
                        })}
                      </ListBody>
                    </ListTable>
                  </ListPanel>
                </section>
              )}
              <p className="text-xs text-[#9c898f]">
                El costo por pieza, el descuento y la promoción vienen del
                catálogo y definen el costo neto.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <SearchBox
                    label="Buscar producto"
                    placeholder="Buscar por nombre o SKU"
                    value={query}
                    onChange={setQuery}
                  />
                </div>
                <button
                  type="button"
                  aria-pressed={onlyBoxes}
                  className={`min-h-[42px] rounded-[10px] border px-3.5 text-sm ${
                    onlyBoxes
                      ? 'border-[#785e67] bg-[#785e67] text-white'
                      : 'border-[#eee7e0] bg-white text-[#785e67] hover:bg-[#f4eef0]'
                  }`}
                  onClick={() => setOnlyBoxes((current) => !current)}
                >
                  Solo con cajas
                </button>
              </div>
              {own.length ? (
                <OrderTable
                  products={visible}
                  boxes={draft.boxes}
                  standardByProductId={standard}
                  stockByProductId={stock}
                  onBoxes={(productId, boxes) =>
                    setDraft((current) => ({
                      ...current,
                      boxes: { ...current.boxes, [productId]: boxes },
                    }))
                  }
                  onEdit={canEditPrices ? setEditingId : undefined}
                  failed={failed}
                />
              ) : (
                <p className="py-6 text-center text-sm text-[#907e84]">
                  Este proveedor aún no tiene productos en el catálogo.
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-[#907e84]">
              Selecciona un proveedor para ver sus productos.
            </p>
          )}
        </form>
      </InventoryDialog>
      {canEditPrices && editing && (
        // Saving reloads the products, so the rows recalculate with the new amounts and typed boxes stay.
        <WarehousePricesDialog
          key={`${draft.warehouseId}:${editing.id}`}
          product={editing}
          warehouseId={draft.warehouseId}
          canEditCost={canEditPrices}
          onPricesSaved={() => setReloadStandard((count) => count + 1)}
          onClose={() => setEditingId(undefined)}
        />
      )}
    </>
  )
}

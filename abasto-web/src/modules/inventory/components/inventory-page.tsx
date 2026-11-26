import {
  ClipboardCheckIcon,
  LayoutGridIcon,
  ClockIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  ScaleIcon,
  Trash2Icon,
  TruckIcon,
} from 'lucide-react'
import { Await } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

import { useBusiness } from '#/modules/business/hooks/use-business'
import { PageHeading } from '#/components/page-heading'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { CountsTab } from '#/modules/inventory/components/counts-tab'
import { LossesTab } from '#/modules/inventory/components/losses-tab'
import { MovementsTab } from '#/modules/inventory/components/movements-tab'
import { PanelSkeleton } from '#/modules/inventory/components/panel-skeleton'
import type { ProductLabel } from '#/modules/inventory/components/movement-table'
import { activeProducts } from '#/modules/inventory/lib/active-products'
import { ProductsTab } from '#/modules/inventory/components/products-tab'
import { SupplierOrdersTab } from '#/modules/inventory/components/supplier-orders-tab'
import { SupplierPendingsTab } from '#/modules/inventory/components/supplier-pendings-tab'
import { WarehouseSummary } from '#/modules/inventory/components/warehouse-summary'
import { CountDialog } from '#/modules/inventory/forms/count-dialog'
import { LotsDialog } from '#/modules/inventory/forms/lots-dialog'
import {
  LossEditDialog,
  LossVoidDialog,
} from '#/modules/inventory/forms/loss-edit-dialog'
import type { LossTarget } from '#/modules/inventory/forms/loss-edit-dialog'
import { MermaDialog } from '#/modules/inventory/forms/merma-dialog'
import { MinimumDialog } from '#/modules/inventory/forms/minimum-dialog'
import { CancelOrderDialog } from '#/modules/inventory/forms/cancel-order-dialog'
import { OrderDetailDialog } from '#/modules/inventory/forms/order-detail-dialog'
import { OrderDialog } from '#/modules/inventory/forms/order-dialog'
import { ReceptionDialog } from '#/modules/inventory/forms/reception-dialog'
import { ReturnDialog } from '#/modules/inventory/forms/return-dialog'
import { ScrapDialog } from '#/modules/inventory/forms/scrap-dialog'
import {
  buildInventoryCountPdf,
  hasCountableStock,
} from '#/modules/inventory/lib/inventory-count-pdf'
import { freePieces } from '#/modules/inventory/lib/loss-ledger'
import { tabBadges } from '#/modules/inventory/lib/tab-badges'
import type { InventoryAction } from '#/modules/inventory/lib/inventory-action'
import {
  packInfoOf,
  quantityPresentations,
} from '#/modules/inventory/lib/pack-info'
import {
  filterStock,
  matchesFilter,
  productStatus,
} from '#/modules/inventory/lib/stock-metrics'
import type { StatusFilter } from '#/modules/inventory/lib/stock-metrics'
import type { InventoryOverview } from '#/modules/inventory/types/stock'
import { TransfersTab } from '#/modules/transfers/components/transfers-tab'
import { CancelTransferDialog } from '#/modules/transfers/forms/cancel-transfer-dialog'
import { ReceiveDialog } from '#/modules/transfers/forms/receive-dialog'
import { TransferDialog } from '#/modules/transfers/forms/transfer-dialog'
import type { TransferListItem } from '#/modules/transfers/services/transfer-reads'
import type { InventorySecondary } from '#/modules/inventory/types/secondary'
import type {
  CatalogProduct,
  CatalogSupplier,
} from '#/modules/catalog/lib/catalog-types'
import type { ProductStock } from '#/modules/inventory/services/stock-reads'
import type {
  SupplierOrder,
  SupplierOrderSummary,
} from '#/modules/inventory/services/supplier-orders'
import type { PendingBalance } from '#/modules/inventory/services/supplier-pendings'

type InventoryPageProps = {
  overview: InventoryOverview
  products: Array<CatalogProduct>
  suppliers: Array<CatalogSupplier>
  /** Whether the actor may edit catalog products (owner). */
  canEditProducts: boolean
  /** Transfers, supplier orders and balances; streamed after the main table. */
  secondary: Promise<InventorySecondary>
  /** Pre-filled product search, e.g. from Catálogo "Consultar inventario". */
  initialQuery: string
  /** Dialog to open on arrival, e.g. from an Inicio alert. */
  initialAction?: InventoryAction
  /** Called when that dialog closes, so a reload does not reopen it. */
  onActionDone?: () => void
  onSelectWarehouse: (warehouseId: string) => void
}

const tabs: Array<{ name: string; icon: LucideIcon }> = [
  { name: 'Productos', icon: LayoutGridIcon },
  { name: 'Por recibir', icon: ClockIcon },
  { name: 'Saldos', icon: ScaleIcon },
  { name: 'Movimientos', icon: RotateCcwIcon },
  { name: 'Mermas', icon: Trash2Icon },
  { name: 'Conteos', icon: ClipboardCheckIcon },
  { name: 'Traslados', icon: TruckIcon },
]

const headingButton =
  'max-md:min-h-[43px] max-md:px-[11px] max-md:py-[9px] max-md:text-[11px]'

type Dialog =
  | { kind: 'order'; productId?: string }
  | { kind: 'orderDetail'; order: SupplierOrderSummary }
  | { kind: 'editOrder'; order: SupplierOrder }
  | { kind: 'receiveOrder'; order: SupplierOrderSummary }
  | { kind: 'cancelOrder'; order: SupplierOrderSummary }
  | { kind: 'return'; pending: PendingBalance }
  | { kind: 'scrap'; pending: PendingBalance }
  | { kind: 'count' }
  | { kind: 'merma'; productId: string }
  | { kind: 'editLoss'; loss: LossTarget }
  | { kind: 'voidLoss'; loss: LossTarget }
  | { kind: 'transfer' }
  | { kind: 'receive'; transfer: TransferListItem }
  | { kind: 'cancel'; transfer: TransferListItem }
  | { kind: 'minimum'; productId: string }
  | { kind: 'lots'; productId: string; removeLotId?: string }

export function InventoryPage({
  overview,
  products,
  suppliers,
  canEditProducts,
  secondary,
  initialQuery,
  initialAction,
  onActionDone,
  onSelectWarehouse,
}: InventoryPageProps) {
  const business = useBusiness()
  const [tab, setTab] = useState('Productos')
  const tabListRef = useRef<HTMLDivElement>(null)
  // On phones the strip scrolls sideways: keep the active tab in view.
  useEffect(() => {
    tabListRef.current
      ?.querySelector('[data-slot=tabs-trigger][data-selected]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [tab])
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<StatusFilter>('Todos')
  const [supplierId, setSupplierId] = useState('')
  const [moveType, setMoveType] = useState('Todos')
  const [dialog, setDialog] = useState<Dialog | null>(() =>
    initialAction?.kind === 'quitar'
      ? {
          kind: 'lots',
          productId: initialAction.productId,
          removeLotId: initialAction.lotId,
        }
      : initialAction?.kind === 'pedido'
        ? { kind: 'order', productId: initialAction.productId }
        : null,
  )
  const closeDialog = () => {
    setDialog(null)
    if (initialAction) onActionDone?.()
  }

  const pickable = useMemo(() => activeProducts(products), [products])

  const labels = useMemo(
    () =>
      new Map<string, ProductLabel>(
        products.map((product) => [
          product.id,
          { name: product.name, sku: product.sku, pack: packInfoOf(product) },
        ]),
      ),
    [products],
  )

  const supplierOf = useMemo(
    () =>
      new Map(
        products.flatMap((product) =>
          product.supplierId ? [[product.id, product.supplierId] as const] : [],
        ),
      ),
    [products],
  )

  const packs = useMemo(
    () => new Map([...labels].map(([id, label]) => [id, label.pack])),
    [labels],
  )

  const selected = overview.warehouses.find(
    ({ id }) => id === overview.selectedId,
  )
  if (!selected) {
    return (
      <div className="text-base">
        <PageHeading
          title="Inventario"
          description="Ten a la mano lo que entra, lo que sale y lo que tienes."
        />
        <p className="text-sm text-ink-muted">
          Aún no tienes almacenes asignados.
        </p>
      </div>
    )
  }

  const { canManage } = selected
  const stock = overview.stock
  const rows = filterStock(stock, query, filter, supplierId, supplierOf)
  const low = stock.filter((row) => matchesFilter(row, 'Stock bajo')).length
  const soldOut = stock.filter(
    (row) => productStatus(row) === 'Sin existencias',
  ).length
  const managed = overview.warehouses.filter((warehouse) => warehouse.canManage)
  const manages = new Set(managed.map((warehouse) => warehouse.id))
  const lotsRow: ProductStock | undefined =
    dialog?.kind === 'lots'
      ? stock.find((row) => row.productId === dialog.productId)
      : undefined
  const mermaRow: ProductStock | undefined =
    dialog?.kind === 'merma'
      ? stock.find((row) => row.productId === dialog.productId)
      : undefined
  const lotsProduct = products.find(({ id }) => id === lotsRow?.productId)

  const exportCountPdf = async () => {
    const document = buildInventoryCountPdf({
      rows: stock,
      packs,
      business: business.name,
      warehouseName: selected.name,
      today: overview.today,
      supplierId,
    })
    const { downloadPdfReport } =
      await import('#/modules/reports/lib/pdf-render')
    await downloadPdfReport(document)
  }
  const lossProducts = new Map(
    stock.map((row) => [
      row.productId,
      { name: row.name, sku: row.sku, imageUrl: row.imageUrl },
    ]),
  )
  const supplierNames = new Map(
    suppliers.map((supplier) => [supplier.id, supplier.name]),
  )

  return (
    <div className="text-base">
      <PageHeading
        title="Inventario"
        description="Ten a la mano lo que entra, lo que sale y lo que tienes."
        actions={
          canManage ? (
            <div className="grid w-full grid-cols-2 gap-2.5 md:contents">
              <ActionButton
                className={headingButton}
                disabled={!hasCountableStock(stock, supplierId)}
                onClick={exportCountPdf}
              >
                <PrinterIcon size={18} />
                Imprimir inventario
              </ActionButton>
              <ActionButton
                tone="primary"
                className={headingButton}
                onClick={() => setDialog({ kind: 'order' })}
              >
                <PlusIcon size={19} />
                Nuevo pedido
              </ActionButton>
            </div>
          ) : undefined
        }
      />
      <WarehouseSummary
        warehouses={overview.warehouses}
        selectedId={selected.id}
        onWarehouseChange={(id) => {
          setFilter('Todos')
          onSelectWarehouse(id)
        }}
        counts={{ products: stock.length, low, soldOut }}
        canManage={canManage}
        onStat={(next) => {
          setTab('Productos')
          setFilter(next)
        }}
      />
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (next === null) return
          setTab(next)
          setQuery('')
        }}
        className="flex-col gap-0"
      >
        <TabsList
          ref={tabListRef}
          variant="line"
          className="max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden mb-5 h-12 w-full justify-start gap-[22px] overflow-x-auto overflow-y-hidden rounded-none border-b border-panel-border p-0 md:mb-[25px] md:gap-[17px] md:overflow-visible tablet:gap-6 wide:gap-[26px]"
        >
          {tabs.map(({ name, icon: Icon }) => (
            <TabsTrigger
              key={name}
              value={name}
              className="h-full flex-none gap-[5px] rounded-none border-0 px-0.5 pt-0 pb-[13px] max-md:px-0 text-xs font-[550] text-ink-faint data-selected:font-[650] data-selected:text-ink-heading md:gap-2 md:text-sm after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-t-[3px] after:bg-ring data-selected:after:opacity-100 max-md:[&_svg]:size-3.5"
            >
              <Icon size={17} />
              {name}
              <Await promise={secondary} fallback={<></>}>
                {({ supplierOrders, pendings }) => {
                  const badges = tabBadges({
                    orders: supplierOrders,
                    restock: pendings.restock,
                    returns: pendings.returns,
                  })
                  return (
                    name in badges && (
                      <span
                        className="rounded-full bg-ring px-1.5 text-[11px] leading-[18px] font-[650] text-white"
                        aria-label={`${badges[name as keyof typeof badges]} pendientes`}
                      >
                        {badges[name as keyof typeof badges]}
                      </span>
                    )
                  )
                }}
              </Await>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Productos" className="text-base">
          <ProductsTab
            rows={rows}
            total={stock.length}
            packs={packs}
            today={overview.today}
            canManage={canManage}
            canAdjustStock={selected.canAdjustStock}
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            suppliers={suppliers}
            supplierId={supplierId}
            onSupplierChange={setSupplierId}
            onLots={(row) =>
              setDialog({ kind: 'lots', productId: row.productId })
            }
            onMinimum={(productId) => setDialog({ kind: 'minimum', productId })}
            onMerma={(row) =>
              setDialog({ kind: 'merma', productId: row.productId })
            }
          />
        </TabsContent>
        <TabsContent value="Por recibir" className="text-base">
          <Await promise={secondary} fallback={<PanelSkeleton />}>
            {({ supplierOrders }) => (
              <SupplierOrdersTab
                orders={supplierOrders}
                canManage={canManage}
                onNew={() => setDialog({ kind: 'order' })}
                onDetail={(order) => setDialog({ kind: 'orderDetail', order })}
                onReceive={(order) =>
                  setDialog({ kind: 'receiveOrder', order })
                }
                onCancel={(order) => setDialog({ kind: 'cancelOrder', order })}
              />
            )}
          </Await>
        </TabsContent>
        <TabsContent value="Saldos" className="text-base">
          <Await promise={secondary} fallback={<PanelSkeleton />}>
            {({ pendings }) => (
              <SupplierPendingsTab
                restock={pendings.restock}
                returns={pendings.returns}
                credits={pendings.credits}
                history={pendings.history}
                suppliers={supplierNames}
                products={labels}
                onReturn={(pending) => setDialog({ kind: 'return', pending })}
                onScrap={(pending) => setDialog({ kind: 'scrap', pending })}
              />
            )}
          </Await>
        </TabsContent>
        <TabsContent value="Movimientos" className="text-base">
          <MovementsTab
            rows={overview.movements}
            products={labels}
            query={query}
            onQueryChange={setQuery}
            type={moveType}
            onTypeChange={setMoveType}
          />
        </TabsContent>
        <TabsContent value="Mermas" className="text-base">
          <LossesTab
            rows={overview.losses}
            products={lossProducts}
            today={overview.today}
            canEdit={selected.canAdjustStock}
            onEdit={(loss) => setDialog({ kind: 'editLoss', loss })}
            onVoid={(loss) => setDialog({ kind: 'voidLoss', loss })}
          />
        </TabsContent>
        <TabsContent value="Conteos" className="text-base">
          <CountsTab
            rows={overview.movements}
            products={labels}
            canManage={canManage}
            onNew={() => setDialog({ kind: 'count' })}
          />
        </TabsContent>
        <TabsContent value="Traslados" className="text-base">
          <Await promise={secondary} fallback={<PanelSkeleton />}>
            {({ transfers }) => (
              <TransfersTab
                transfers={transfers.transfers}
                manages={manages}
                canSend={canManage && transfers.destinations.length > 0}
                onNew={() => setDialog({ kind: 'transfer' })}
                onReceive={(transfer) =>
                  setDialog({ kind: 'receive', transfer })
                }
                onCancel={(transfer) => setDialog({ kind: 'cancel', transfer })}
              />
            )}
          </Await>
        </TabsContent>
      </Tabs>

      {dialog?.kind === 'editLoss' && (
        <LossEditDialog loss={dialog.loss} onClose={closeDialog} />
      )}
      {dialog?.kind === 'voidLoss' && (
        <LossVoidDialog loss={dialog.loss} onClose={closeDialog} />
      )}
      {mermaRow && (
        <MermaDialog
          warehouseId={selected.id}
          product={{
            productId: mermaRow.productId,
            name: mermaRow.name,
            sku: mermaRow.sku,
            imageUrl: mermaRow.imageUrl,
            available: freePieces(mermaRow),
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'order' && (
        <Await promise={secondary} fallback={<></>}>
          {({ pendings }) => (
            <OrderDialog
              warehouses={managed}
              initialWarehouseId={selected.id}
              suppliers={suppliers}
              products={pickable}
              canEditProducts={canEditProducts}
              discountable={[...pendings.restock, ...pendings.credits]}
              initialProductId={dialog.productId}
              onClose={closeDialog}
            />
          )}
        </Await>
      )}
      {dialog?.kind === 'orderDetail' && (
        <OrderDetailDialog
          order={dialog.order}
          onEdit={
            canManage
              ? (order) => setDialog({ kind: 'editOrder', order })
              : undefined
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'editOrder' && (
        <OrderDialog
          order={dialog.order}
          warehouses={managed}
          initialWarehouseId={dialog.order.warehouseId}
          suppliers={suppliers}
          products={pickable}
          canEditProducts={canEditProducts}
          discountable={[]}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'receiveOrder' && (
        <Await promise={secondary} fallback={<></>}>
          {({ pendings }) => (
            <ReceptionDialog
              order={dialog.order}
              restock={pendings.restock}
              products={pickable}
              canUpdateCatalog={canEditProducts}
              onClose={() => setDialog(null)}
            />
          )}
        </Await>
      )}
      {dialog?.kind === 'cancelOrder' && (
        <CancelOrderDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'return' && (
        <ReturnDialog
          pending={dialog.pending}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'scrap' && (
        <ScrapDialog pending={dialog.pending} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'count' && (
        <CountDialog
          warehouseId={selected.id}
          products={pickable}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'minimum' && (
        <MinimumDialog
          warehouseId={selected.id}
          products={pickable}
          stock={stock}
          productId={dialog.productId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'transfer' && (
        <Await promise={secondary} fallback={<></>}>
          {({ transfers }) => (
            <TransferDialog
              from={selected}
              destinations={transfers.destinations}
              products={pickable}
              stock={stock}
              onClose={() => setDialog(null)}
            />
          )}
        </Await>
      )}
      {dialog?.kind === 'receive' && (
        <ReceiveDialog
          transfer={dialog.transfer}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelTransferDialog
          transfer={dialog.transfer}
          onClose={() => setDialog(null)}
        />
      )}
      {lotsRow && (
        <LotsDialog
          stock={lotsRow}
          pack={
            labels.get(lotsRow.productId)?.pack ?? {
              packName: lotsRow.unit,
              factor: 1,
              unit: lotsRow.unit,
            }
          }
          presentations={lotsProduct ? quantityPresentations(lotsProduct) : []}
          today={overview.today}
          canAdjustStock={selected.canAdjustStock}
          removeLotId={dialog?.kind === 'lots' ? dialog.removeLotId : undefined}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

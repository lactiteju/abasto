import { createFileRoute } from '@tanstack/react-router'

import { unwrap } from '#/lib/boundary'
import {
  listCatalogProductsFn,
  listSuppliersFn,
} from '#/modules/catalog/server/catalog'
import { InventoryPage } from '#/modules/inventory/components/inventory-page'
import { inventoryActionOf } from '#/modules/inventory/lib/inventory-action'
import { inventoryOverviewFn } from '#/modules/inventory/server/inventory'
import { inventorySecondaryFn } from '#/modules/inventory/server/inventory-secondary'

type InventorySearch = {
  /** Optional product query, e.g. from Catálogo "Consultar inventario". */
  q?: string
  /** Optional warehouse id, e.g. from Almacenes "Ver inventario". */
  almacen?: string
  /** Dialog to open on arrival, e.g. from an Inicio alert: `quitar` or `pedido`. */
  accion?: string
  producto?: string
  lote?: string
}

export const Route = createFileRoute('/inventario')({
  validateSearch: (search: Record<string, unknown>): InventorySearch => ({
    ...(typeof search.q === 'string' && search.q.trim() !== ''
      ? { q: search.q }
      : {}),
    ...(typeof search.almacen === 'string' && search.almacen !== ''
      ? { almacen: search.almacen }
      : {}),
    ...(() => {
      const action = inventoryActionOf(search)
      if (!action) return {}
      return action.kind === 'quitar'
        ? { accion: 'quitar', producto: action.productId, lote: action.lotId }
        : { accion: 'pedido', producto: action.productId }
    })(),
  }),
  loaderDeps: ({ search }) => ({ almacen: search.almacen }),
  loader: ({ deps }) => {
    const data = { warehouseId: deps.almacen }
    // Transfers, supplier orders and balances stream in after the table. The
    // server resolves the selected warehouse for them, so every read starts
    // now instead of after the overview.
    const secondary = inventorySecondaryFn({ data }).then(unwrap)
    // Nobody awaits it before the loader returns; a failure shows in its panels.
    secondary.catch(() => undefined)
    return Promise.all([
      inventoryOverviewFn({ data }),
      listCatalogProductsFn(),
      listSuppliersFn(),
    ]).then(([overview, products, suppliers]) => ({
      overview: unwrap(overview),
      products: unwrap(products),
      suppliers: unwrap(suppliers),
      secondary,
    }))
  },
  component: InventoryRoute,
})

function InventoryRoute() {
  const search = Route.useSearch()
  const { q } = search
  const { overview, products, suppliers, secondary } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  return (
    <InventoryPage
      // A different warehouse starts with fresh filters.
      key={overview.selectedId ?? 'none'}
      overview={overview}
      products={products}
      suppliers={suppliers}
      // Catalog costs and prices are the owner's.
      canEditProducts={user?.role === 'owner'}
      secondary={secondary}
      initialQuery={q ?? ''}
      initialAction={inventoryActionOf(search)}
      onActionDone={() =>
        void navigate({
          replace: true,
          search: ({ accion: _a, producto: _p, lote: _l, ...rest }) => rest,
        })
      }
      onSelectWarehouse={(almacen) =>
        void navigate({ search: (current) => ({ ...current, almacen }) })
      }
    />
  )
}

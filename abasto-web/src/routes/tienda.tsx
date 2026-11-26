import { Outlet, createFileRoute } from '@tanstack/react-router'

import { unwrap } from '#/lib/boundary'
import { StoreShell } from '#/modules/store/components/store-shell'
import { storeTitle } from '#/modules/store/lib/store-config'
import {
  storeCatalogFn,
  storeWarehousesFn,
} from '#/modules/store/server/storefront'

export const Route = createFileRoute('/tienda')({
  validateSearch: (search: Record<string, unknown>): { almacen?: string } =>
    typeof search.almacen === 'string' && search.almacen
      ? { almacen: search.almacen }
      : {},
  loaderDeps: ({ search }) => ({ almacen: search.almacen }),
  loader: async ({ deps }) => {
    const catalogOf = async (warehouseId: string) =>
      unwrap(await storeCatalogFn({ data: { warehouseId } }))
    // A requested warehouse loads its catalog alongside the list; an unknown
    // one falls back to the first below, like before.
    const [warehouseResult, requested] = await Promise.all([
      storeWarehousesFn(),
      deps.almacen
        ? catalogOf(deps.almacen).then(
            (catalog) => ({ id: deps.almacen, catalog }),
            () => null,
          )
        : null,
    ])
    const warehouses = unwrap(warehouseResult)
    const warehouse =
      warehouses.find((entry) => entry.id === deps.almacen) ??
      warehouses.at(0) ??
      null
    const catalog = !warehouse
      ? []
      : requested?.id === warehouse.id
        ? requested.catalog
        : await catalogOf(warehouse.id)
    return { warehouses, warehouse, catalog }
  },
  head: ({ match }) => ({
    meta: [{ title: storeTitle('Tienda', match.context.business.name) }],
  }),
  component: function StoreLayout() {
    const { user } = Route.useRouteContext()
    const { warehouse, catalog } = Route.useLoaderData()
    return (
      <StoreShell user={user} warehouse={warehouse} catalog={catalog}>
        <Outlet />
      </StoreShell>
    )
  },
})

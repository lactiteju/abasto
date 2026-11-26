import { PageHeading } from '#/components/page-heading'
import { OwnerTransferDialog } from '#/modules/transfers/forms/owner-transfer-dialog'
import { CreateWarehouseDialog } from '#/modules/warehouses/components/create-warehouse-dialog'
import { WarehouseCard } from '#/modules/warehouses/components/warehouse-card'
import type { WarehouseWithMetrics } from '#/modules/warehouses/server/warehouses'

type WarehousesPageProps = {
  warehouses: Array<WarehouseWithMetrics>
  canCreate: boolean
}

export function WarehousesPage({ warehouses, canCreate }: WarehousesPageProps) {
  return (
    <>
      <PageHeading
        title="Almacenes"
        description="Cada existencia tiene un lugar."
        actions={
          canCreate ? (
            <>
              {warehouses.length >= 2 ? (
                <OwnerTransferDialog warehouses={warehouses} />
              ) : null}
              <CreateWarehouseDialog />
            </>
          ) : undefined
        }
      />
      {warehouses.length ? (
        <div
          data-stagger
          className="grid grid-cols-1 gap-[15px] tablet:grid-cols-3 wide:gap-[22px]"
        >
          {warehouses.map((warehouse) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              canRename={canCreate}
            />
          ))}
        </div>
      ) : (
        <p className="animate-rise-in text-sm text-ink-muted">
          {canCreate
            ? 'Aún no hay almacenes. Crea el primero.'
            : 'Aún no tienes almacenes asignados.'}
        </p>
      )}
    </>
  )
}

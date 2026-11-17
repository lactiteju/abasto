import { PencilIcon, PlusIcon, PowerIcon, UserRoundIcon } from 'lucide-react'

import { StatusBadge } from '#/components/status-badge'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { EmptyPanel } from '#/modules/inventory/components/empty-panel'
import {
  ListBody,
  ListCell,
  ListHead,
  ListPanel,
  ListRow,
  ListTable,
} from '#/modules/inventory/components/list-panel'
import { SectionRow } from '#/modules/inventory/components/section-row'
import { RowActionsMenu } from '#/modules/riders/components/row-actions-menu'
import { useRiderActions } from '#/modules/riders/hooks/use-rider-actions'
import type { Rider } from '#/modules/riders/services/riders'

type RidersCatalogProps = {
  riders: ReadonlyArray<Rider>
  /** Riders with an assignment "En ruta": they cannot get a new one. */
  onRouteIds: ReadonlySet<string>
  onNew: () => void
  onRename: (rider: Rider) => void
}

/** The warehouse's riders (owner only): add, rename, activate or deactivate. */
export function RidersCatalog({
  riders,
  onRouteIds,
  onNew,
  onRename,
}: RidersCatalogProps) {
  const actions = useRiderActions()
  return (
    <section aria-label="Repartidores">
      <SectionRow
        title="Repartidores"
        description="Quién puede recibir producto en este almacén. Un repartidor inactivo no recibe repartos nuevos."
        action={
          <ActionButton onClick={onNew}>
            <PlusIcon size={19} />
            Nuevo repartidor
          </ActionButton>
        }
      />
      {riders.length ? (
        <ListPanel>
          <ListTable>
            <ListHead>{['Nombre', 'Estado', 'Reparto', '']}</ListHead>
            <ListBody>
              {riders.map((rider) => (
                <ListRow key={rider.id}>
                  <ListCell>
                    <strong className="text-[#5f4a51]">{rider.name}</strong>
                  </ListCell>
                  <ListCell>
                    <StatusBadge tone={rider.active ? 'green' : 'gray'}>
                      {rider.active ? 'Activo' : 'Inactivo'}
                    </StatusBadge>
                  </ListCell>
                  <ListCell>
                    {onRouteIds.has(rider.id) ? (
                      <StatusBadge tone="blue">En ruta</StatusBadge>
                    ) : (
                      <span className="text-sm text-[#907e84]">
                        {rider.active ? 'Disponible' : '—'}
                      </span>
                    )}
                  </ListCell>
                  <ListCell>
                    <span className="flex justify-end">
                      <RowActionsMenu
                        label={`Acciones de ${rider.name}`}
                        items={[
                          {
                            key: 'rename',
                            label: 'Renombrar',
                            icon: (
                              <PencilIcon className="size-4 text-[#927981]" />
                            ),
                            onSelect: () => onRename(rider),
                          },
                          {
                            key: 'active',
                            label: rider.active ? 'Desactivar' : 'Activar',
                            icon: <PowerIcon className="size-4" />,
                            destructive: rider.active,
                            disabled: actions.pending,
                            onSelect: () =>
                              void actions.setActive(rider.id, !rider.active),
                          },
                        ]}
                      />
                    </span>
                  </ListCell>
                </ListRow>
              ))}
            </ListBody>
          </ListTable>
        </ListPanel>
      ) : (
        <EmptyPanel
          icon={UserRoundIcon}
          title="Aún no hay repartidores"
          description="Agrega a quien reparte para poder asignarle producto."
        />
      )}
    </section>
  )
}

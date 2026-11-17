import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeading } from '#/components/page-heading'
import { FieldSelect } from '#/modules/counter/components/form-controls'
import { WarningInline } from '#/modules/inventory/components/info-blocks'
import { hasWarehouseChoice } from '#/modules/warehouses/lib/warehouse-choice'
import { AssignmentProductsDialog } from '#/modules/riders/components/assignment-products-dialog'
import { AssignmentsSection } from '#/modules/riders/components/assignments-section'
import { RidersCatalog } from '#/modules/riders/components/riders-catalog'
import { AssignDialog } from '#/modules/riders/forms/assign-dialog'
import { CancelAssignmentDialog } from '#/modules/riders/forms/cancel-assignment-dialog'
import { EditLoadDialog } from '#/modules/riders/forms/edit-load-dialog'
import { RiderDialog } from '#/modules/riders/forms/rider-dialog'
import { SettleDialog } from '#/modules/riders/forms/settle-dialog'
import {
  prefillFromSettlement,
  prepareNextBlock,
} from '#/modules/riders/lib/next-assignment'
import { newAssignmentBlock } from '#/modules/riders/lib/assign-availability'
import type { RidersOverview } from '#/modules/riders/lib/riders-view'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'
import type { Rider } from '#/modules/riders/services/riders'

type RepartosPageProps = {
  overview: RidersOverview
  onSelectWarehouse: (warehouseId: string) => void
}

type Open =
  | { kind: 'assign' }
  | { kind: 'rider'; rider?: Rider }
  | { kind: 'view'; assignment: AssignmentDetail }
  | { kind: 'settle'; assignment: AssignmentDetail }
  | { kind: 'cancel'; assignment: AssignmentDetail }
  | { kind: 'recharge'; assignment: AssignmentDetail }
  | { kind: 'edit'; assignment: AssignmentDetail }
  | { kind: 'next'; assignment: AssignmentDetail }

/** «Nuevo reparto» for the same rider, prefilled with what came back. */
function NextAssignmentDialog({
  assignment,
  riders,
  products,
  onClose,
}: {
  assignment: AssignmentDetail
  riders: ReadonlyArray<Rider>
  products: RidersOverview['products']
  onClose: () => void
}) {
  const prefill = prefillFromSettlement(assignment.lines, products)
  const notices = [
    ...(prefill.capped.length
      ? [`Se ajustó a lo disponible: ${prefill.capped.join(', ')}.`]
      : []),
    ...(prefill.unavailable.length
      ? [
          `Sin existencia ahora, no se incluyó: ${prefill.unavailable.join(', ')}.`,
        ]
      : []),
  ]
  return (
    <AssignDialog
      key={assignment.id}
      riders={riders}
      products={products}
      initialRiderId={assignment.riderId}
      initialLines={prefill.lines}
      notices={notices}
      onClose={onClose}
    />
  )
}

/** Repartos: stock loaned to delivery riders for the day, settled at night. */
export function RepartosPage({
  overview,
  onSelectWarehouse,
}: RepartosPageProps) {
  const [open, setOpen] = useState<Open>()
  const close = () => setOpen(undefined)
  const selected = overview.warehouses.find(
    ({ id }) => id === overview.selectedId,
  )

  const heading = (
    <PageHeading
      title="Repartos"
      description="Asigna producto a tus repartidores y, al final del día, liquida lo que vendieron y lo que sobró."
    />
  )
  if (!selected) {
    return (
      <>
        {heading}
        <p className="text-sm text-ink-muted">
          Aún no tienes almacenes asignados.
        </p>
      </>
    )
  }

  const onRoute = new Set(
    overview.assignments
      .filter(({ status }) => status === 'En ruta')
      .map(({ riderId }) => riderId),
  )
  const freeRiders = overview.riders.filter(
    (rider) => rider.active && !onRoute.has(rider.id),
  )
  const hasOpen = onRoute.size > 0
  const blockedReason = newAssignmentBlock({
    activeRiders: overview.riders.filter(({ active }) => active).length,
    freeRiders: freeRiders.length,
    products: overview.products.length,
  })

  return (
    <>
      {heading}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        {hasWarehouseChoice(overview.warehouses) ? (
          <label className="flex min-w-[220px] flex-col gap-[7px] text-[13px] font-medium text-[#513f45]">
            Almacén
            <FieldSelect
              value={selected.id}
              onChange={(event) => onSelectWarehouse(event.target.value)}
            >
              {overview.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </FieldSelect>
          </label>
        ) : (
          <p className="flex min-w-[220px] flex-col gap-[7px] text-[13px] font-medium text-[#513f45]">
            Almacén
            <span className="text-[15px] font-semibold text-[#2f2328]">
              {selected.name}
            </span>
          </p>
        )}
      </div>
      {!overview.cash && (
        <WarningInline className="mt-0 mb-5">
          {hasOpen
            ? 'La caja de este almacén está cerrada. Puedes asignar, pero para liquidar un reparto necesitas abrirla en Ventas.'
            : 'La caja de este almacén está cerrada. Para liquidar un reparto necesitarás abrirla en Ventas.'}
        </WarningInline>
      )}
      <AssignmentsSection
        assignments={overview.assignments}
        canAssign={blockedReason === null}
        blockedReason={blockedReason}
        onNew={() => setOpen({ kind: 'assign' })}
        onAction={(action, assignment) => {
          if (action === 'prepareNext') {
            const block = prepareNextBlock(
              assignment.riderId,
              onRoute,
              overview.riders.some(
                (rider) => rider.id === assignment.riderId && rider.active,
              ),
            )
            if (block) return toast.error(block)
            if (!overview.products.length) {
              return toast.error(
                'No hay producto disponible en este almacén para repartir.',
              )
            }
            return setOpen({ kind: 'next', assignment })
          }
          setOpen({ kind: action, assignment })
        }}
      />
      <RidersCatalog
        riders={overview.riders}
        onRouteIds={onRoute}
        canManage={overview.canManage}
        onNew={() => setOpen({ kind: 'rider' })}
        onRename={(rider) => setOpen({ kind: 'rider', rider })}
      />
      {open?.kind === 'view' && (
        <AssignmentProductsDialog
          key={open.assignment.id}
          assignment={open.assignment}
          onClose={close}
        />
      )}
      {open?.kind === 'assign' && (
        <AssignDialog
          riders={freeRiders}
          products={overview.products}
          onClose={close}
        />
      )}
      {open?.kind === 'recharge' && (
        <AssignDialog
          key={open.assignment.id}
          riders={[]}
          products={overview.products}
          recharge={open.assignment}
          onClose={close}
        />
      )}
      {open?.kind === 'edit' && (
        <EditLoadDialog
          key={open.assignment.id}
          assignment={open.assignment}
          products={overview.products}
          onClose={close}
        />
      )}
      {open?.kind === 'next' && (
        <NextAssignmentDialog
          assignment={open.assignment}
          riders={freeRiders}
          products={overview.products}
          onClose={close}
        />
      )}
      {open?.kind === 'rider' && (
        <RiderDialog
          key={open.rider?.id ?? 'new'}
          warehouseId={selected.id}
          rider={open.rider}
          onClose={close}
        />
      )}
      {open?.kind === 'settle' && (
        <SettleDialog
          key={open.assignment.id}
          assignment={open.assignment}
          cashOpen={overview.cash !== null}
          onClose={close}
        />
      )}
      {open?.kind === 'cancel' && (
        <CancelAssignmentDialog assignment={open.assignment} onClose={close} />
      )}
    </>
  )
}

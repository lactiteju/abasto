import { PlusIcon, TruckIcon } from 'lucide-react'

import { StatusBadge } from '#/components/status-badge'
import { AssignmentActionsMenu } from '#/modules/riders/components/assignment-actions-menu'
import { ActionButton } from '#/modules/inventory/components/action-button'
import { EmptyPanel } from '#/modules/inventory/components/empty-panel'
import { dateLabel, timeLabel } from '#/modules/inventory/lib/format'
import {
  ListBody,
  ListCell,
  ListHead,
  ListPanel,
  ListRow,
  ListTable,
} from '#/modules/inventory/components/list-panel'
import { SectionRow } from '#/modules/inventory/components/section-row'
import { formatCents } from '#/modules/pricing/lib/money'
import { describeQuantity } from '#/modules/riders/lib/box-quantities'
import {
  differenceLabel,
  statusTone,
} from '#/modules/riders/lib/assignment-view'
import type { RowAction } from '#/modules/riders/lib/next-assignment'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

type AssignmentsSectionProps = {
  assignments: ReadonlyArray<AssignmentDetail>
  /** There is at least one rider and one product that can be assigned. */
  canAssign: boolean
  /** Why "Nuevo reparto" is unavailable, shown next to the button. */
  blockedReason?: string | null
  onNew: () => void
  onAction: (action: RowAction, assignment: AssignmentDetail) => void
}

/** Open assignments ("En ruta") and the ones settled or cancelled today. */
export function AssignmentsSection({
  assignments,
  canAssign,
  blockedReason,
  onNew,
  onAction,
}: AssignmentsSectionProps) {
  return (
    <section aria-label="Repartos" className="mb-9">
      <SectionRow
        title="Repartos de hoy"
        description="Lo que sigue en ruta, aunque sea de días anteriores, y lo que se liquidó o canceló hoy."
        action={
          <div className="flex flex-col items-end gap-1.5">
            <ActionButton
              tone="primary"
              disabled={!canAssign}
              aria-describedby={
                !canAssign && blockedReason ? 'nuevo-reparto-motivo' : undefined
              }
              onClick={onNew}
            >
              <PlusIcon size={19} />
              Nuevo reparto
            </ActionButton>
            {!canAssign && blockedReason && (
              <small
                id="nuevo-reparto-motivo"
                className="max-w-[300px] text-right text-xs text-[#785e67]"
              >
                {blockedReason}
              </small>
            )}
          </div>
        }
      />
      {assignments.length ? (
        <ListPanel>
          <ListTable>
            <ListHead>
              {['Repartidor', 'Productos', 'Estado', 'Fecha', '']}
            </ListHead>
            <ListBody>
              {assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onAction={onAction}
                />
              ))}
            </ListBody>
          </ListTable>
        </ListPanel>
      ) : (
        <EmptyPanel
          icon={TruckIcon}
          title="No hay repartos hoy"
          description={
            canAssign
              ? 'Asigna producto a un repartidor y aparecerá aquí.'
              : 'Para asignar necesitas un repartidor activo y producto disponible.'
          }
        />
      )}
    </section>
  )
}

function AssignmentRow({
  assignment,
  onAction,
}: {
  assignment: AssignmentDetail
  onAction: (action: RowAction, assignment: AssignmentDetail) => void
}) {
  const settled = assignment.status === 'Liquidada'
  const when = new Date(
    assignment.closedAt ?? assignment.createdAt,
  ).toISOString()
  return (
    <ListRow>
      <ListCell>
        <strong className="text-[#5f4a51]">{assignment.riderName}</strong>
      </ListCell>
      <ListCell>
        {assignment.lines.map((line) => (
          <span key={line.id} className="block">
            <strong>{line.productName}</strong>{' '}
            {describeQuantity(line.assignedQuantity, line.boxFactor)}
            {settled && line.soldQuantity !== null && (
              <small className="block text-[#907e84]">
                Vendió {describeQuantity(line.soldQuantity, line.boxFactor)} ·
                regresó{' '}
                {describeQuantity(line.leftoverQuantity ?? 0, line.boxFactor)}
              </small>
            )}
          </span>
        ))}
      </ListCell>
      <ListCell>
        <StatusBadge tone={statusTone(assignment.status)}>
          {assignment.status}
        </StatusBadge>
        {settled && assignment.expectedCents !== null && (
          <small className="block">
            Esperado {formatCents(assignment.expectedCents)} · entregó{' '}
            {formatCents(assignment.deliveredCents ?? 0)}
            <span className="block font-semibold">
              {differenceLabel(assignment.differenceCents ?? 0)}
            </span>
          </small>
        )}
      </ListCell>
      <ListCell>
        {assignment.status === 'En ruta' ? 'Salió ' : 'Cerró '}
        {dateLabel(when)}
        <small className="block text-[#907e84]">{timeLabel(when)}</small>
      </ListCell>
      <ListCell>
        <span className="flex justify-end">
          <AssignmentActionsMenu assignment={assignment} onAction={onAction} />
        </span>
      </ListCell>
    </ListRow>
  )
}

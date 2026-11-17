import { StatusBadge } from '#/components/status-badge'
import { ActionButton } from '#/modules/inventory/components/action-button'
import {
  DialogActions,
  InventoryDialog,
} from '#/modules/inventory/components/inventory-dialog'
import { formatCents } from '#/modules/pricing/lib/money'
import { DifferenceText } from '#/modules/riders/components/difference-text'
import { loadSummary, statusTone } from '#/modules/riders/lib/assignment-view'
import { describeQuantity } from '#/modules/riders/lib/box-quantities'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

type AssignmentProductsDialogProps = {
  assignment: AssignmentDetail
  onClose: () => void
}

const th =
  'px-3 py-2.5 text-left text-xs font-semibold text-[#8a767c] first:pl-0 last:pr-0'
const td = 'px-3 py-3 align-top text-sm text-[#5f4a51] first:pl-0 last:pr-0'

/** Everything an assignment carried and, once settled, what came of it. */
export function AssignmentProductsDialog({
  assignment,
  onClose,
}: AssignmentProductsDialogProps) {
  const settled = assignment.status === 'Liquidada'
  const summary = loadSummary(assignment.lines)
  return (
    <InventoryDialog
      title={`Productos de ${assignment.riderName}`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(assignment.status)}>
            {assignment.status}
          </StatusBadge>
          {summary.detail}
        </span>
      }
      size={settled ? 'count' : 'standard'}
      onClose={onClose}
      footer={
        <DialogActions>
          <ActionButton type="button" onClick={onClose}>
            Cerrar
          </ActionButton>
        </DialogActions>
      }
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#efe8e0]">
            <th className={th}>Producto</th>
            <th className={th}>Asignado</th>
            {settled && (
              <>
                <th className={th}>Vendió</th>
                <th className={th}>Regresó</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {assignment.lines.map((line) => (
            <tr key={line.id} className="border-b border-[#f4efe9]">
              <td className={td}>
                <strong className="font-[650]">{line.productName}</strong>
              </td>
              <td className={td}>
                {describeQuantity(line.assignedQuantity, line.boxFactor)}
              </td>
              {settled && (
                <>
                  <td className={td}>
                    {describeQuantity(line.soldQuantity ?? 0, line.boxFactor)}
                  </td>
                  <td className={td}>
                    {describeQuantity(
                      line.leftoverQuantity ?? 0,
                      line.boxFactor,
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {settled && assignment.expectedCents !== null && (
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-[10px] bg-[#faf6f1] px-4 py-3 text-sm text-[#5f4a51]">
          <dt>Esperado</dt>
          <dd className="text-right">
            {formatCents(assignment.expectedCents)}
          </dd>
          <dt>Entregó</dt>
          <dd className="text-right">
            {formatCents(assignment.deliveredCents ?? 0)}
          </dd>
          <dt className="font-semibold">Diferencia</dt>
          <dd className="text-right">
            <DifferenceText cents={assignment.differenceCents ?? 0} />
          </dd>
        </dl>
      )}
    </InventoryDialog>
  )
}

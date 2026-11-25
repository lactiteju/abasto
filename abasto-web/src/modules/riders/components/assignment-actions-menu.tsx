import {
  CheckCheckIcon,
  ListIcon,
  PencilIcon,
  PackagePlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react'

import { RowActionsMenu } from '#/components/row-actions-menu'
import {
  rowActionLabels,
  rowActionsFor,
} from '#/modules/riders/lib/next-assignment'
import type { RowAction } from '#/modules/riders/lib/next-assignment'
import type { AssignmentDetail } from '#/modules/riders/services/assignment-reads'

import type { ReactNode } from 'react'

type AssignmentActionsMenuProps = {
  assignment: AssignmentDetail
  onAction: (action: RowAction, assignment: AssignmentDetail) => void
}

const iconClass = 'size-4 text-[#927981]'

const icons: Record<RowAction, ReactNode> = {
  view: <ListIcon className={iconClass} />,
  recharge: <PackagePlusIcon className={iconClass} />,
  edit: <PencilIcon className={iconClass} />,
  settle: <CheckCheckIcon className={iconClass} />,
  cancel: <XIcon className="size-4" />,
  printNote: <PrinterIcon className={iconClass} />,
  prepareNext: <RotateCcwIcon className={iconClass} />,
}

/** The «⋯» menu of an assignment row: the actions allowed for its state. */
export function AssignmentActionsMenu({
  assignment,
  onAction,
}: AssignmentActionsMenuProps) {
  return (
    <RowActionsMenu
      label={`Acciones de ${assignment.riderName}`}
      items={rowActionsFor(assignment.status).map((action) => ({
        key: action,
        label: rowActionLabels[action],
        icon: icons[action],
        destructive: action === 'cancel',
        onSelect: () => onAction(action, assignment),
      }))}
    />
  )
}

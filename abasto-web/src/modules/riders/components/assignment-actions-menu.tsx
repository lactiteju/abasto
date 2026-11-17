import {
  CheckCheckIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { ActionButton } from '#/modules/inventory/components/action-button'
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

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#3b2251] outline-none select-none data-[highlighted]:bg-[#f8f2ec]'

const icons: Record<RowAction, ReactNode> = {
  recharge: <PackagePlusIcon className="size-4 text-[#927981]" />,
  settle: <CheckCheckIcon className="size-4 text-[#927981]" />,
  cancel: <XIcon className="size-4 text-[#927981]" />,
  prepareNext: <RotateCcwIcon className="size-4 text-[#927981]" />,
}

/** One «⋯» button per row that opens the actions allowed for its state. */
export function AssignmentActionsMenu({
  assignment,
  onAction,
}: AssignmentActionsMenuProps) {
  const actions = rowActionsFor(assignment.status)
  if (!actions.length) return null
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <ActionButton
          className="min-h-9 px-3"
          aria-label={`Acciones de ${assignment.riderName}`}
        >
          <MoreHorizontalIcon size={18} />
        </ActionButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-[10px] border border-[#efe8e0] bg-white p-1 shadow-[0_8px_24px_rgba(59,34,81,0.12)]"
        >
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action}
              className={item}
              onSelect={() => onAction(action, assignment)}
            >
              {icons[action]}
              {rowActionLabels[action]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

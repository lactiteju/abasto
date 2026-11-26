import { MoreHorizontalIcon } from 'lucide-react'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@ui-sdk/react/menu'

import { ActionButton } from '#/modules/inventory/components/action-button'
import { cn } from '#/lib/utils/cn'
import { popupMotionClass } from '#/components/ui/popup-motion'

import { Fragment } from 'react'
import type { ReactNode } from 'react'

export type RowMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  /** Separated from the rest and drawn in a warning tone. */
  destructive?: boolean
  onSelect: () => void
}

type RowActionsMenuProps = {
  /** Accessible name of the «⋯» button, e.g. «Acciones de Oscar». */
  label: string
  items: ReadonlyArray<RowMenuItem>
}

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-heading outline-none select-none data-disabled:cursor-default data-disabled:opacity-50 transition-colors duration-100 ease-out data-highlighted:bg-muted'

/** One «⋯» button per table row that opens the row's actions. */
export function RowActionsMenu({ label, items }: RowActionsMenuProps) {
  if (!items.length) return null
  return (
    <Menu modal={false}>
      <MenuTrigger
        render={
          <ActionButton className="min-h-9 px-3" aria-label={label}>
            <MoreHorizontalIcon size={18} />
          </ActionButton>
        }
      />
      <MenuContent
        align="end"
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-[10px] border border-border bg-popover p-1 shadow-md',
          popupMotionClass,
        )}
      >
        {items.map((entry, index) => (
          <Fragment key={entry.key}>
            {entry.destructive && index > 0 && (
              <MenuSeparator className="my-1 h-px bg-row-border" />
            )}
            <MenuItem
              className={cn(item, entry.destructive && 'text-destructive')}
              disabled={entry.disabled}
              onSelect={() => entry.onSelect()}
            >
              {entry.icon}
              {entry.label}
            </MenuItem>
          </Fragment>
        ))}
      </MenuContent>
    </Menu>
  )
}

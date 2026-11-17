import { MoreHorizontalIcon } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

import { ActionButton } from '#/modules/inventory/components/action-button'
import { cn } from '#/lib/utils/cn'

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
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#3b2251] outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-[#f8f2ec]'

/** One «⋯» button per table row that opens the row's actions. */
export function RowActionsMenu({ label, items }: RowActionsMenuProps) {
  if (!items.length) return null
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <ActionButton className="min-h-9 px-3" aria-label={label}>
          <MoreHorizontalIcon size={18} />
        </ActionButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-[10px] border border-[#efe8e0] bg-white p-1 shadow-[0_8px_24px_rgba(59,34,81,0.12)]"
        >
          {items.map((entry, index) => (
            <Fragment key={entry.key}>
              {entry.destructive && index > 0 && (
                <DropdownMenu.Separator className="my-1 h-px bg-[#f1ebe5]" />
              )}
              <DropdownMenu.Item
                className={cn(item, entry.destructive && 'text-[#a3253f]')}
                disabled={entry.disabled}
                onSelect={entry.onSelect}
              >
                {entry.icon}
                {entry.label}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

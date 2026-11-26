import { Link } from '@tanstack/react-router'
import {
  ArchiveRestoreIcon,
  ChevronDownIcon,
  PackageSearchIcon,
  PencilIcon,
  TagIcon,
} from 'lucide-react'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/react/menu'

import { CatalogButton } from '#/modules/catalog/components/catalog-button'

import type { ReactNode } from 'react'

type CatalogRowActionsProps = {
  productName: string
  /** Each action shows only when its handler is given. */
  onPrices?: () => void
  onEdit?: () => void
  onRestore?: () => void
}

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-heading outline-none select-none data-highlighted:bg-muted'

function Action({
  icon,
  children,
  onSelect,
}: {
  icon: ReactNode
  children: ReactNode
  onSelect: () => void
}) {
  return (
    <MenuItem className={item} onSelect={() => onSelect()}>
      {icon}
      {children}
    </MenuItem>
  )
}

/** One "Acciones" button per catalog row that opens its actions. */
export function CatalogRowActions({
  productName,
  onPrices,
  onEdit,
  onRestore,
}: CatalogRowActionsProps) {
  const icon = 'size-4 text-ink-subtle'
  return (
    <Menu modal={false}>
      <MenuTrigger
        render={
          <CatalogButton
            className="min-h-9 px-3"
            aria-label={`Acciones de ${productName}`}
          >
            Acciones
            <ChevronDownIcon className="size-4" />
          </CatalogButton>
        }
      />
      <MenuContent
        align="end"
        sideOffset={6}
        className="z-50 min-w-48 rounded-[10px] border border-border bg-popover p-1 shadow-md transition duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
      >
        {onRestore && (
          <Action
            icon={<ArchiveRestoreIcon className={icon} />}
            onSelect={onRestore}
          >
            Restaurar
          </Action>
        )}
        {onPrices && (
          <Action icon={<TagIcon className={icon} />} onSelect={onPrices}>
            Precios
          </Action>
        )}
        {onEdit && (
          <Action icon={<PencilIcon className={icon} />} onSelect={onEdit}>
            Editar
          </Action>
        )}
        <MenuItem
          className={item}
          render={<Link to="/inventario" search={{ q: productName }} />}
        >
          <PackageSearchIcon className={icon} />
          Consultar inventario
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

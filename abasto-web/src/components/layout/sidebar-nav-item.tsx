import { Link } from '@tanstack/react-router'

import { useSidebar } from '#/components/ui/sidebar'
import { cn } from '#/lib/utils/cn'
import type { NavItem } from '#/config/navigation'

const itemClass =
  'group/nav relative flex w-full items-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 gap-[13px] rounded-lg px-[15px] py-2.5 text-left text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-white data-[status=active]:bg-primary data-[status=active]:font-bold data-[status=active]:text-sidebar-active data-[status=active]:hover:bg-primary data-[status=active]:hover:text-sidebar-active transition-[color,background-color,scale] duration-(--duration-hover) ease-(--ease-out) active:scale-(--scale-press) motion-reduce:active:scale-100 before:pointer-events-none before:absolute before:inset-y-2.5 before:left-1.5 before:w-[3px] before:scale-y-0 before:rounded-full before:bg-white before:opacity-0 before:transition-[scale,opacity] before:duration-(--duration-dialog-in) before:ease-(--ease-spring) data-[status=active]:before:scale-y-100 data-[status=active]:before:opacity-100'

const iconClass =
  'shrink-0 transition-transform duration-(--duration-hover) ease-(--ease-out) group-hover/nav:translate-x-0.5 group-data-[status=active]/nav:scale-110 motion-reduce:group-hover/nav:translate-x-0 motion-reduce:group-data-[status=active]/nav:scale-100'

type SidebarNavItemProps = {
  item: NavItem
  iconSize?: number
  className?: string
}

export function SidebarNavItem({
  item,
  iconSize = 20,
  className,
}: SidebarNavItemProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const Icon = item.icon

  if (!item.to) {
    return (
      <button type="button" className={cn(itemClass, className)}>
        <Icon size={iconSize} className={iconClass} />
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <Link
      to={item.to}
      className={cn(itemClass, className)}
      activeProps={{ 'aria-current': 'page' }}
      onClick={() => isMobile && setOpenMobile(false)}
    >
      <Icon size={iconSize} className={iconClass} />
      <span>{item.label}</span>
    </Link>
  )
}

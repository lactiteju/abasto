import type { ComponentProps } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils/cn'

/**
 * White bordered card hosting a list table (`.list-panel`). With `scroll` it
 * gets a viewport-relative height and scrolls both ways itself, so the
 * horizontal scrollbar stays at the bottom of the card, not the page.
 */
export function ListPanel({
  className,
  scroll = false,
  ...props
}: ComponentProps<'div'> & { scroll?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[12px] border border-[#eee7e0] bg-white',
        scroll &&
          'max-h-[max(24rem,calc(100dvh-16rem))] overflow-auto [&>[data-slot=table-container]]:overflow-visible',
        className,
      )}
      {...props}
    />
  )
}

/** Keeps the header in view while the body scrolls (needs a scrolling panel). */
export function ListHead({
  children,
  sticky = false,
}: {
  children: Array<string>
  sticky?: boolean
}) {
  return (
    <TableHeader
      className={
        sticky
          ? 'sticky top-0 z-10 bg-[#fcfaf7] shadow-[inset_0_-1px_0_#eee7e0]'
          : undefined
      }
    >
      <TableRow>
        {children.map((label, index) => (
          <TableHead
            key={`${label}-${index}`}
            className="h-auto bg-[#fcfaf7] p-[15px] text-xs font-[550] text-[#947e85] md:px-5 md:py-[14px]"
          >
            {label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

export function ListCell({
  className,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn(
        'p-[15px] text-sm leading-5 text-[#785e67] md:px-5 md:py-[18px] [&_small]:mt-[5px] [&_small]:text-xs [&_small]:leading-[1.4] [&_button]:leading-5 [&_strong]:font-semibold',
        className,
      )}
      {...props}
    />
  )
}

export { Table as ListTable, TableBody as ListBody, TableRow as ListRow }

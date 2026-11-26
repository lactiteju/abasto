import * as React from 'react'
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@ui-sdk/react/drawer'
import { XIcon } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils/cn'

type SheetSide = 'top' | 'right' | 'bottom' | 'left'

type SheetContentProps = Omit<
  React.ComponentProps<typeof DrawerContent>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
  side?: SheetSide
  /** Navigation drawers without a close button must still close on an outside tap. */
  dismissOnOutside?: boolean
  showCloseButton?: boolean
}

/**
 * Drawer takes `side` and the outside-press rule on its root, but callers set
 * them on `SheetContent`: read them from that child so the API stays put.
 */
function Sheet({
  children,
  side,
  closeOnOutsidePress,
  ...props
}: React.ComponentProps<typeof Drawer>) {
  const content = React.Children.toArray(children).find(
    (child): child is React.ReactElement<SheetContentProps> =>
      React.isValidElement(child) && child.type === SheetContent,
  )
  return (
    <Drawer
      side={side ?? content?.props.side ?? 'right'}
      closeOnOutsidePress={
        closeOnOutsidePress ?? content?.props.dismissOnOutside ?? false
      }
      {...props}
    >
      {children}
    </Drawer>
  )
}

function SheetTrigger(props: React.ComponentProps<typeof DrawerTrigger>) {
  return <DrawerTrigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof DrawerClose>) {
  return <DrawerClose data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  side: _side,
  showCloseButton = true,
  dismissOnOutside: _dismissOnOutside,
  ...props
}: SheetContentProps) {
  return (
    <>
      <DrawerBackdrop
        data-slot="sheet-overlay"
        className="bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
      />
      <DrawerContent
        data-slot="sheet-content"
        className={cn(
          'relative z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none data-[side=bottom]:h-auto data-[side=bottom]:w-full data-[side=bottom]:border-t data-[side=left]:h-full data-[side=left]:max-h-none data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:h-full data-[side=right]:max-h-none data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:h-auto data-[side=top]:w-full data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerClose
            data-slot="sheet-close"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'absolute top-3 right-3',
            )}
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DrawerClose>
        )}
      </DrawerContent>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-0.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DrawerTitle>, 'className'> & {
  className?: string
}) {
  return (
    <DrawerTitle
      data-slot="sheet-title"
      className={cn('text-base font-medium text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DrawerDescription>, 'className'> & {
  className?: string
}) {
  return (
    <DrawerDescription
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

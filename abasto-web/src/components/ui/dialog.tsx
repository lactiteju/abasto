import * as React from 'react'
import {
  Dialog as DialogRoot,
  DialogBackdrop,
  DialogClose as DialogClosePart,
  DialogContent as DialogContentPart,
  DialogDescription as DialogDescriptionPart,
  DialogTitle as DialogTitlePart,
  DialogTrigger as DialogTriggerPart,
} from '@ui-sdk/react/dialog'
import { XIcon } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import {
  MaximizeButton,
  maximizedClass,
  useMaximized,
} from '#/components/ui/dialog-maximize'
import { escapeClosesOpenList } from '#/lib/open-list-escape'
import { cn } from '#/lib/utils/cn'

/** Backdrop transition shared by dialogs, alert dialogs and sheets. */
export const backdropClass =
  'fixed inset-0 z-50 bg-black/10 transition-opacity duration-(--duration-dialog-in) ease-out supports-backdrop-filter:backdrop-blur-xs data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-(--duration-dialog-out)'

/** Centered in the top layer: scale 0.96 to 1 with a spring on enter, 220ms in and 160ms out. */
export const centeredPopupClass =
  'fixed inset-0 z-50 m-auto h-fit outline-none transition-[opacity,scale] duration-(--duration-dialog-in) ease-spring data-starting-style:scale-(--scale-popup) data-starting-style:opacity-0 data-ending-style:scale-(--scale-popup) data-ending-style:opacity-0 data-ending-style:duration-(--duration-dialog-out) data-ending-style:ease-out'

type DialogProps = React.ComponentProps<typeof DialogRoot>

/**
 * Outside presses never dismiss a dialog (Esc and the close button still do);
 * pass `closeOnOutsidePress` to opt back in. Esc in an open picker closes the
 * list, not the whole dialog.
 */
function Dialog({
  closeOnOutsidePress = false,
  onOpenChange,
  ...props
}: DialogProps) {
  return (
    <DialogRoot
      closeOnOutsidePress={closeOnOutsidePress}
      onOpenChange={(open, details) => {
        if (
          !open &&
          details.reason === 'escape-key' &&
          escapeClosesOpenList(details.event?.target)
        ) {
          details.cancel()
          return
        }
        onOpenChange?.(open, details)
      }}
      {...props}
    />
  )
}

/** `asChild` keeps Radix-style call sites: the single child becomes the trigger. */
function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogTriggerPart> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <DialogTriggerPart
        data-slot="dialog-trigger"
        render={children}
        {...props}
      />
    )
  }
  return (
    <DialogTriggerPart data-slot="dialog-trigger" {...props}>
      {children}
    </DialogTriggerPart>
  )
}

function DialogClose(props: React.ComponentProps<typeof DialogClosePart>) {
  return <DialogClosePart data-slot="dialog-close" {...props} />
}

type DialogContentProps = Omit<
  React.ComponentProps<typeof DialogContentPart>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
  /** Extra classes for the dimmed backdrop. */
  overlayClassName?: string
  showCloseButton?: boolean
  /** Offer the full-screen corner button; off when a wrapper draws its own. */
  maximizable?: boolean
  /** Where the full-screen button sits, to line up with a custom close button. */
  maximizeButtonClassName?: string
}

function DialogContent({
  className,
  overlayClassName,
  children,
  showCloseButton = true,
  maximizable = true,
  maximizeButtonClassName,
  ...props
}: DialogContentProps) {
  const { maximized, toggle } = useMaximized()
  const full = maximizable && maximized
  return (
    <>
      <DialogBackdrop
        data-slot="dialog-overlay"
        className={cn(backdropClass, overlayClassName)}
      />
      <DialogContentPart
        data-slot="dialog-content"
        data-maximized={full || undefined}
        className={cn(
          centeredPopupClass,
          'group/dialog grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 sm:max-w-sm',
          className,
          full && maximizedClass,
        )}
        {...props}
      >
        {children}
        {maximizable && (
          <MaximizeButton
            maximized={maximized}
            onToggle={toggle}
            className={cn(
              'absolute',
              showCloseButton ? 'top-[15px] right-11' : 'top-4 right-4',
              maximizeButtonClassName,
            )}
          />
        )}
        {showCloseButton && (
          <DialogClosePart
            data-slot="dialog-close"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'absolute top-2 right-2',
            )}
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogClosePart>
        )}
      </DialogContentPart>
    </>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClosePart className={buttonVariants({ variant: 'outline' })}>
          Cerrar
        </DialogClosePart>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogTitlePart>, 'className'> & {
  className?: string
}) {
  return (
    <DialogTitlePart
      data-slot="dialog-title"
      className={cn('text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogDescriptionPart>, 'className'> & {
  className?: string
}) {
  return (
    <DialogDescriptionPart
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}

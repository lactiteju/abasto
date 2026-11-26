'use client'

import * as React from 'react'
import {
  AlertDialog as AlertDialogRoot,
  AlertDialogBackdrop,
  AlertDialogClose as AlertDialogClosePart,
  AlertDialogContent as AlertDialogContentPart,
  AlertDialogDescription as AlertDialogDescriptionPart,
  AlertDialogTitle as AlertDialogTitlePart,
  AlertDialogTrigger as AlertDialogTriggerPart,
} from '@ui-sdk/react/alert-dialog'

import { buttonVariants } from '#/components/ui/button'
import { backdropClass, centeredPopupClass } from '#/components/ui/dialog'
import {
  MaximizeButton,
  maximizedClass,
  useMaximized,
} from '#/components/ui/dialog-maximize'
import { cn } from '#/lib/utils/cn'

function AlertDialog(props: React.ComponentProps<typeof AlertDialogRoot>) {
  return <AlertDialogRoot {...props} />
}

function AlertDialogTrigger(
  props: React.ComponentProps<typeof AlertDialogTriggerPart>,
) {
  return <AlertDialogTriggerPart data-slot="alert-dialog-trigger" {...props} />
}

/** Unstyled answer button, for call sites that draw their own. */
function AlertDialogClose(
  props: React.ComponentProps<typeof AlertDialogClosePart>,
) {
  return <AlertDialogClosePart data-slot="alert-dialog-close" {...props} />
}

function AlertDialogContent({
  className,
  size = 'default',
  maximizable = true,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof AlertDialogContentPart>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
  size?: 'default' | 'sm'
  /** Offer the full-screen corner button. */
  maximizable?: boolean
}) {
  const { maximized, toggle } = useMaximized()
  const full = maximizable && maximized
  return (
    <>
      <AlertDialogBackdrop
        data-slot="alert-dialog-overlay"
        className={backdropClass}
      />
      <AlertDialogContentPart
        data-slot="alert-dialog-content"
        data-size={size}
        data-maximized={full || undefined}
        className={cn(
          centeredPopupClass,
          'group/alert-dialog-content grid w-full gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm',
          className,
          full && maximizedClass,
          full &&
            'data-[size=default]:max-w-none data-[size=sm]:max-w-none data-[size=default]:sm:max-w-none',
        )}
        {...props}
      >
        {children}
        {maximizable && (
          <MaximizeButton
            maximized={maximized}
            onToggle={toggle}
            className="absolute top-2 right-2"
          />
        )}
      </AlertDialogContentPart>
    </>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogTitlePart>, 'className'> & {
  className?: string
}) {
  return (
    <AlertDialogTitlePart
      data-slot="alert-dialog-title"
      className={cn(
        'text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof AlertDialogDescriptionPart>,
  'className'
> & {
  className?: string
}) {
  return (
    <AlertDialogDescriptionPart
      data-slot="alert-dialog-description"
      className={cn(
        'text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

type AnswerButtonProps = Omit<
  React.ComponentProps<typeof AlertDialogClosePart>,
  'className'
> & {
  className?: string
} & Pick<Parameters<typeof buttonVariants>[0] & object, 'variant' | 'size'>

function AlertDialogAction({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: AnswerButtonProps) {
  return (
    <AlertDialogClosePart
      data-slot="alert-dialog-action"
      value="confirm"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = 'outline',
  size = 'default',
  ...props
}: AnswerButtonProps) {
  return (
    <AlertDialogClosePart
      data-slot="alert-dialog-cancel"
      value="cancel"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
}

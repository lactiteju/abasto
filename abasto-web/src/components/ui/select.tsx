'use client'

import * as React from 'react'
import { cn } from '#/lib/utils/cn'
import {
  Select as SelectRoot,
  SelectContent as SelectContentPart,
  SelectGroup as SelectGroupPart,
  SelectGroupLabel,
  SelectItem as SelectItemPart,
  SelectItemIndicator,
  SelectSeparator as SelectSeparatorPart,
  SelectTrigger as SelectTriggerPart,
  SelectValue as SelectValuePart,
} from '@ui-sdk/react/select'
import type { SelectProps } from '@ui-sdk/react/select'
import { ChevronDownIcon, CheckIcon } from 'lucide-react'

type SelectSingle = Extract<SelectProps<string>, { multiple?: false }>

const FORM_INPUT = '[data-slot="select-form-input"]'

type SingleSelectProps = Omit<
  SelectProps<string>,
  'multiple' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  value?: string | null
  defaultValue?: string | null
  /** Single selection only; there is no clear button, so never `null`. */
  onValueChange?: (
    value: string,
    details: Parameters<NonNullable<SelectSingle['onValueChange']>>[1],
  ) => void
}

function Select({ onValueChange, ...props }: SingleSelectProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  return (
    // ui-sdk submits through a hidden textarea; `invalid` does not bubble, so
    // catch it in the capture phase to show Spanish text.
    <span
      ref={ref}
      className="contents"
      onInvalidCapture={(event) => {
        const field = event.target as HTMLTextAreaElement
        if (!field.matches(FORM_INPUT)) return
        field.setCustomValidity('')
        if (field.validity.valueMissing) {
          field.setCustomValidity('Elige una opción.')
        }
      }}
    >
      <SelectRoot
        data-slot="select"
        onValueChange={(value: string | string[] | null, details) => {
          // A chosen value must lift the Spanish message set on the last submit.
          ref.current
            ?.querySelector<HTMLTextAreaElement>(FORM_INPUT)
            ?.setCustomValidity('')
          if (typeof value === 'string') onValueChange?.(value, details)
        }}
        {...props}
      />
    </span>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupPart>) {
  return (
    <SelectGroupPart
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectValuePart>) {
  return <SelectValuePart data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectTriggerPart>, 'children'> & {
  size?: 'sm' | 'default'
  children?: React.ReactNode
}) {
  return (
    <SelectTriggerPart
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </SelectTriggerPart>
  )
}

/** Popup placement only: ui-sdk has no item-aligned mode like Radix's default. */
function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectContentPart>) {
  return (
    <SelectContentPart
      data-slot="select-content"
      sideOffset={sideOffset}
      className={cn(
        'relative z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children}
    </SelectContentPart>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectGroupLabel>) {
  return (
    <SelectGroupLabel
      data-slot="select-label"
      className={cn('px-1.5 py-1 text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectItemPart>, 'children'> & {
  children?: React.ReactNode
}) {
  return (
    <SelectItemPart
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </SelectItemIndicator>
    </SelectItemPart>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectSeparatorPart>) {
  return (
    <SelectSeparatorPart
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

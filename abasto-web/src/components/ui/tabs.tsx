import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { useHydrated } from '#/hooks/use-hydrated'
import { cn } from '#/lib/utils/cn'
import {
  Tabs as TabsRoot,
  TabsIndicator,
  TabsList as TabsListPart,
  TabsPanel,
  TabsTab,
} from '@ui-sdk/react/tabs'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsRoot>) {
  return (
    <TabsRoot
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsListPart>, 'children'> & {
  children?: React.ReactNode
} & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsListPart
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      <TabsIndicator
        className={cn(
          'pointer-events-none absolute top-0 left-0 transition-[translate,width,height] duration-(--duration-tab) ease-out data-[activation-direction=none]:transition-none',
          'w-(--active-tab-width) [translate:var(--active-tab-left)_var(--active-tab-top)]',
          'group-data-[variant=default]/tabs-list:h-(--active-tab-height) group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:bg-background group-data-[variant=default]/tabs-list:shadow-sm',
          'group-data-[variant=line]/tabs-list:h-0.5 group-data-[variant=line]/tabs-list:bg-foreground group-data-[variant=line]/tabs-list:[translate:var(--active-tab-left)_calc(var(--active-tab-top)+var(--active-tab-height)+3px)]',
          'group-data-[variant=line]/tabs-list:group-data-[orientation=vertical]/tabs:h-(--active-tab-height) group-data-[variant=line]/tabs-list:group-data-[orientation=vertical]/tabs:w-0.5 group-data-[variant=line]/tabs-list:group-data-[orientation=vertical]/tabs:[translate:calc(var(--active-tab-left)+var(--active-tab-width)+2px)_var(--active-tab-top)]',
        )}
      />
      {children}
    </TabsListPart>
  )
}

function TabsTrigger({
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof TabsTab>) {
  const hydrating = !useHydrated()
  return (
    <TabsTab
      data-slot="tabs-trigger"
      data-hydrating={hydrating || undefined}
      disabled={disabled || hydrating}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] duration-(--duration-tab) ease-out data-hydrating:transition-none group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-disabled:pointer-events-none data-disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // The sliding TabsIndicator draws the pill or underline; before
        // hydration it is not measured, so the tab paints it itself.
        'z-10 data-selected:text-foreground dark:data-selected:text-foreground',
        'data-hydrating:data-selected:group-data-[variant=default]/tabs-list:bg-background data-hydrating:data-selected:group-data-[variant=default]/tabs-list:shadow-sm',
        'after:absolute after:bg-foreground after:opacity-0 group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 data-hydrating:data-selected:group-data-[variant=line]/tabs-list:after:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPanel>) {
  return (
    <TabsPanel
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

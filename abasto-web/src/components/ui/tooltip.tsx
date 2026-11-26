import * as React from 'react'
import { cn } from '#/lib/utils/cn'
import {
  Tooltip as TooltipRoot,
  TooltipContent as TooltipContentPart,
  TooltipTrigger as TooltipTriggerPart,
} from '@ui-sdk/react/tooltip'

/** ui-sdk groups tooltips without a provider; kept so call sites don't change. */
function TooltipProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function Tooltip({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipRoot>) {
  return <TooltipRoot data-slot="tooltip" delay={delay} {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipTriggerPart>) {
  return <TooltipTriggerPart data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPart>) {
  return (
    <TooltipContentPart
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        'z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background transition duration-100 has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children}
    </TooltipContentPart>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }

import { cn } from '#/lib/utils/cn'

/** Slow shimmer over the muted base; static under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,transparent_25%,color-mix(in_oklch,var(--background),transparent_40%)_50%,transparent_75%)] bg-size-[200%_100%] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils/cn'

const panel = 'rounded-xl border border-border bg-card'

export function SkeletonHeading({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-[22px] flex items-center justify-between gap-5 md:mb-7">
      <div className="space-y-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2.5">
        {Array.from({ length: actions }, (_, index) => (
          <Skeleton key={index} className="h-10 w-28 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(panel, 'space-y-3 p-4')}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonToolbar({ filters = 2 }: { filters?: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
      {Array.from({ length: filters }, (_, index) => (
        <Skeleton key={index} className="h-10 w-32 rounded-lg" />
      ))}
    </div>
  )
}

export function SkeletonTable({
  rows = 8,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className={cn(panel, 'overflow-hidden')}>
      <div className="flex gap-6 border-b border-border px-4 py-3.5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton
            key={index}
            className={cn('h-3', index === 0 ? 'w-40' : 'w-20')}
          />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-6 border-b border-border px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: columns }, (_cell, index) => (
            <Skeleton
              key={index}
              className={cn('h-4', index === 0 ? 'w-40' : 'w-20')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 phone:grid-cols-2 md:grid-cols-3 wide:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(panel, 'space-y-3 p-3.5')}>
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPanels({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(panel, 'space-y-4 p-4')}>
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 4 }, (_row, line) => (
            <div key={line} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className={cn(panel, 'mb-6 space-y-4 p-4')}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

export function SkeletonTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-4 flex gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
  )
}

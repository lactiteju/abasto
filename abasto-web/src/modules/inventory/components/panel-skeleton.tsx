import { Skeleton } from '#/components/ui/skeleton'

/** Stands in for a tab panel whose data is still streaming in. */
export function PanelSkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="Cargando"
      aria-busy="true"
    >
      <Skeleton className="h-9 w-48" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

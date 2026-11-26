import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { RouteSkeleton } from '#/components/route-skeletons/route-skeleton'

/** The skeleton shows after this long loading a new path, so fast loads never flash it. */
const SHOW_AFTER_MS = 150
/** Once shown it stays at least this long, so it never flickers away. */
const MIN_VISIBLE_MS = 300

/** Target path while a navigation to another path is loading, else null. */
function useIncomingPath() {
  return useRouterState({
    select: (state) =>
      state.isLoading &&
      state.resolvedLocation &&
      state.resolvedLocation.pathname !== state.location.pathname
        ? state.location.pathname
        : null,
  })
}

function useDelayedPath(incoming: string | null) {
  const [shown, setShown] = useState<string | null>(null)
  const shownAt = useRef(0)
  useEffect(() => {
    if (incoming) {
      if (shownAt.current) {
        setShown(incoming)
        return
      }
      const timer = setTimeout(() => {
        shownAt.current = Date.now()
        setShown(incoming)
      }, SHOW_AFTER_MS)
      return () => clearTimeout(timer)
    }
    if (!shownAt.current) return
    const timer = setTimeout(
      () => {
        shownAt.current = 0
        setShown(null)
      },
      Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current)),
    )
    return () => clearTimeout(timer)
  }, [incoming])
  return shown
}

/**
 * Wraps the routed page. Opening another path swaps in that section's skeleton;
 * reloads of the same path (filters, warehouse, period, router.invalidate after
 * a mutation) keep the current page in place, dimmed while they run. The
 * router's own pending UI is off (`defaultPendingMs: Infinity`) for this.
 */
export function RoutePending({ children }: { children: ReactNode }) {
  const incoming = useIncomingPath()
  const skeletonPath = useDelayedPath(incoming)
  const loading = useRouterState({ select: (state) => state.isLoading })
  const busy = loading && !incoming
  return (
    <>
      {skeletonPath && skeletonPath !== '/login' ? (
        <RouteSkeleton pathname={skeletonPath} />
      ) : null}
      <div
        hidden={!!skeletonPath}
        aria-busy={busy || undefined}
        data-busy={busy ? '' : undefined}
        className="transition-opacity duration-200 data-busy:opacity-70 data-busy:delay-300"
      >
        {children}
      </div>
    </>
  )
}

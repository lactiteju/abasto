import { useRouterState } from '@tanstack/react-router'

/** Thin bar under the top edge while a navigation or reload is in flight. */
export function NavigationProgress() {
  const busy = useRouterState({ select: (state) => state.isLoading })
  return (
    <div
      aria-hidden
      data-busy={busy ? '' : undefined}
      data-slot="nav-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-0 bg-primary opacity-0 data-busy:animate-(--animate-nav-progress) data-busy:opacity-100"
    />
  )
}

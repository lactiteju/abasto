import type { AnyRouter } from '@tanstack/react-router'

/** How long `<html data-entering>` stays: entrance (240ms) + stagger (210ms) + slack. */
const ENTERING_MS = 600

/**
 * Marks `<html data-entering>` as a client navigation to another path commits,
 * so the CSS entrances in styles.css play for it. It is set before the new page
 * mounts, so its elements start animating when created; SSR first paint,
 * hydration and search-param changes within a page never get it.
 */
export function watchRouteEntrance(router: AnyRouter) {
  if (typeof document === 'undefined') return
  let timer: ReturnType<typeof setTimeout> | undefined
  router.subscribe('onBeforeRouteMount', ({ fromLocation, toLocation }) => {
    if (!fromLocation || fromLocation.pathname === toLocation.pathname) return
    const root = document.documentElement
    root.setAttribute('data-entering', '')
    clearTimeout(timer)
    timer = setTimeout(() => root.removeAttribute('data-entering'), ENTERING_MS)
  })
}

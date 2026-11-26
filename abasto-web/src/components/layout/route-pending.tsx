import { useLocation } from '@tanstack/react-router'

import { RouteSkeleton } from '#/components/route-skeletons/route-skeleton'

/** Router default pending UI: skeleton of the section being opened, inside the shell. */
export function RoutePending() {
  const pathname = useLocation({ select: (location) => location.pathname })
  return <RouteSkeleton pathname={pathname} />
}

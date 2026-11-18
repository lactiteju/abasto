import { useRouteContext } from '@tanstack/react-router'
import type { Business } from '#/config/workspace'

/** The persisted business identity, loaded once by the root route. */
export function useBusiness(): Business {
  return useRouteContext({ from: '__root__', select: (c) => c.business })
}

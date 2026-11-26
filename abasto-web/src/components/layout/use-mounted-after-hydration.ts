import { useState } from 'react'

import { useHydrated } from '#/hooks/use-hydrated'

/**
 * True only for components that mounted after hydration (a client-side change),
 * false for server HTML and the hydration render. Fixed at mount, so an entrance
 * keyed on it plays once for new content and never replays on first paint.
 */
export function useMountedAfterHydration(): boolean {
  const hydrated = useHydrated()
  const [lateMount] = useState(hydrated)
  return lateMount
}

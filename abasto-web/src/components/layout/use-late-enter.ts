import { useMountedAfterHydration } from '#/components/layout/use-mounted-after-hydration'

/**
 * Props for an element that should play an entrance only when it mounts after
 * hydration (client navigation, a list emptying), never on server HTML. Spread
 * on the element; styles.css animates `[data-late-enter]`.
 */
export function useLateEnter(kind: 'rise' | 'fade' = 'rise') {
  const late = useMountedAfterHydration()
  return late ? { 'data-late-enter': kind } : {}
}

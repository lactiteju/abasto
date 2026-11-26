import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { useLateEnter } from '#/components/layout/use-late-enter'

type LateEnterProps<T extends ElementType> = {
  as?: T
  kind?: 'rise' | 'fade'
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'kind'>

/**
 * An element that rises (or fades) in when it mounts after hydration, and is
 * static in server HTML. Mount it exactly where the new content appears, so it
 * is its own mount: an empty state, a freshly added list line.
 */
export function LateEnter<T extends ElementType = 'div'>({
  as,
  kind,
  ...props
}: LateEnterProps<T>) {
  const Tag: ElementType = as ?? 'div'
  return <Tag {...useLateEnter(kind)} {...props} />
}

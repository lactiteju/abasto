import { useEffect, useRef, useState } from 'react'

/**
 * Width of an element in px, kept in sync while it resizes. `fallback` is used
 * on the server and before the first measure, so both render the same markup.
 */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setWidth(Math.round(node.clientWidth) || fallback)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [fallback])
  return [ref, width] as const
}

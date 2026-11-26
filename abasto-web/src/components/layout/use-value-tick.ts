import { useState } from 'react'

/**
 * Counts how many times `value` changed since mount: 0 on first render (server
 * HTML, hydration), so a figure ticks only when it updates. Use the count as
 * the element `key` and set `data-tick` when it is above 0.
 */
export function useValueTick(value: string): number {
  const [seen, setSeen] = useState({ value, ticks: 0 })
  if (seen.value !== value) setSeen({ value, ticks: seen.ticks + 1 })
  return seen.ticks
}

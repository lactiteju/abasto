import * as React from 'react'

import { cn } from '#/lib/utils/cn'

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
  ref?: React.Ref<HTMLElement>
}

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/** Renders its single child with the slot's props merged on top of the child's. */
export function Slot({ children, ref, ...slotProps }: SlotProps) {
  if (!React.isValidElement<SlotProps>(children)) return null
  const child = children
  const childProps = child.props
  const merged: Record<string, unknown> = { ...slotProps, ...childProps }

  // Handlers run child first, then the slot's; classes and styles combine.
  const slotRecord = slotProps as Record<string, unknown>
  const childRecord = childProps as Record<string, unknown>
  for (const key of Object.keys(slotRecord)) {
    const slotValue = slotRecord[key]
    const childValue = childRecord[key]
    if (/^on[A-Z]/.test(key) && slotValue && childValue) {
      merged[key] = (...args: unknown[]) => {
        ;(childValue as (...a: unknown[]) => void)(...args)
        ;(slotValue as (...a: unknown[]) => void)(...args)
      }
    }
  }
  merged.className = cn(slotProps.className, childProps.className)
  if (slotProps.style || childProps.style) {
    merged.style = { ...slotProps.style, ...childProps.style }
  }
  const childRef = child.props.ref
  merged.ref = (node: HTMLElement | null) => {
    assignRef(ref, node)
    assignRef(childRef, node)
  }
  return React.cloneElement(child, merged)
}

import * as React from 'react'
import { Textarea as TextareaPrimitive } from '@ui-sdk/react/textarea'
import { cn } from '#/lib/utils/cn'
import {
  applySpanishValidity,
  clearSpanishValidity,
} from '#/hooks/native-validation'

function Textarea({
  className,
  value,
  defaultValue,
  onInvalid,
  onInput,
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'onSubmit'>) {
  return (
    <TextareaPrimitive
      autoResize
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      onInvalid={(event) => {
        applySpanishValidity(event)
        onInvalid?.(event)
      }}
      onInput={(event) => {
        clearSpanishValidity(event)
        onInput?.(event)
      }}
      {...props}
      value={value == null ? undefined : String(value)}
      defaultValue={defaultValue == null ? undefined : String(defaultValue)}
    />
  )
}

export { Textarea }

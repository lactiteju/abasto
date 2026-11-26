import type { ComponentProps, ReactNode } from 'react'

import { NativeSelect } from '#/components/native-select'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils/cn'

const control =
  'h-auto min-h-[43px] rounded-lg border-[#e8e1e3] bg-white px-3 py-2.5 text-sm font-normal text-[#3b2251]'

/** Label above a control. */
export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 flex-col gap-[7px] text-[13px] font-medium text-[#513f45]',
        className,
      )}
    >
      <span className="leading-normal">{label}</span>
      {children}
    </label>
  )
}

export function FieldSelect({
  className,
  ...props
}: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect className={cn('w-full', control, className)} {...props} />
  )
}

export function FieldInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return <Input className={cn(control, className)} {...props} />
}

export function FieldTextarea({
  className,
  ...props
}: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        control,
        'min-h-[75px] resize-y field-sizing-fixed',
        className,
      )}
      {...props}
    />
  )
}

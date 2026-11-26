import type { ComponentProps, ReactNode } from 'react'

import { NativeSelect } from '#/components/native-select'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils/cn'

/** Geometry and colors of the form fields; focus and validity come from the primitives. */
export const fieldControl =
  'h-auto min-h-[43px] rounded-[8px] border-[#e8e1e3] bg-white px-3 py-2.5 text-sm font-normal text-[#3b2251] disabled:bg-[#f8f5f2] disabled:text-[#938288] disabled:opacity-100'

/** The reference hides native number spinners everywhere. */
export const hideSpinners =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

type FieldProps = { label: string; hint?: string; children: ReactNode }

/** Label above a control, with an optional hint underneath. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-[7px] text-[13px] font-medium text-[#513f45]">
      <span className="leading-normal">{label}</span>
      {children}
      {hint && (
        <small className="text-[11px] font-normal text-[#9c888f]">{hint}</small>
      )}
    </label>
  )
}

/** `div` flavour of `Field` for controls that bring their own label (pickers). */
export function FieldGroup({ label, children }: Omit<FieldProps, 'hint'>) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-[550] text-[#866d75]">{label}</span>
      {children}
    </div>
  )
}

/** `inputMode` numeric/decimal fields drop other characters as they are typed. */
export function FieldInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        fieldControl,
        props.type === 'number' && hideSpinners,
        className,
      )}
      {...props}
    />
  )
}

export function FieldSelect({
  className,
  ...props
}: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      className={cn('w-full', fieldControl, className)}
      {...props}
    />
  )
}

export function FieldTextarea({
  className,
  ...props
}: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        fieldControl,
        'min-h-[75px] resize-y field-sizing-fixed',
        className,
      )}
      {...props}
    />
  )
}

/** Grid used by the receipt and import forms (3 columns on desktop). */
export function FormGrid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-3', className)} {...props} />
  )
}

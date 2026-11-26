import type { ComponentProps } from 'react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils/cn'

type ActionButtonProps = ComponentProps<typeof Button> & {
  tone?: 'primary' | 'secondary'
  full?: boolean
}

const base =
  'h-auto min-h-11 gap-[9px] rounded-[9px] px-[17px] py-2.5 text-sm font-[650] disabled:opacity-50'

const tones = {
  primary:
    'bg-primary text-brand-ink shadow-[0_2px_3px_#c81d4e0a] hover:bg-brand-hover hover:shadow-[0_3px_9px_#c81d4e1c] disabled:bg-[#ece6e2] disabled:text-[#8f7f85] disabled:opacity-100 disabled:shadow-none',
  secondary: 'border-[#e8e1e3] bg-white text-[#503f45] hover:bg-[#faf6f1]',
}

/** Reference-style `.btn` (yellow primary, white secondary). */
export function ActionButton({
  tone = 'secondary',
  full = false,
  variant,
  className,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      variant={variant ?? (tone === 'primary' ? 'default' : 'outline')}
      className={cn(base, tones[tone], full && 'w-full', className)}
      {...props}
    />
  )
}

/** Inline link-style button (`.text-link`). */
export function TextLink({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="link"
      className={cn(
        'h-auto justify-start gap-[7px] rounded-none p-0 text-left text-sm font-[650] text-ink-link',
        className,
      )}
      {...props}
    />
  )
}

/** Square ghost button for row actions (`.icon-button`). */
export function IconButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      className={cn(
        'rounded-[7px] text-[#826c73] hover:bg-[#f6f0e9]',
        className,
      )}
      {...props}
    />
  )
}

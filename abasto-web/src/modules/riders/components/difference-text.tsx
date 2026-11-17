import { cn } from '#/lib/utils/cn'
import {
  differenceLabel,
  differenceTone,
} from '#/modules/riders/lib/assignment-view'
import type { DifferenceTone } from '#/modules/riders/lib/assignment-view'

const tones: Record<DifferenceTone, string> = {
  shortage: 'text-[#a3253f]',
  surplus: 'text-[#8a5a12]',
  exact: 'text-[#4f7a5c]',
}

/** «Faltante $40.00», «Sobrante …» or «Sin diferencia», colored by weight. */
export function DifferenceText({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  return (
    <span
      className={cn('font-semibold', tones[differenceTone(cents)], className)}
    >
      {differenceLabel(cents)}
    </span>
  )
}

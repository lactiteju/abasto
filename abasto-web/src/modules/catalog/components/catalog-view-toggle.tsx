import { Button } from '#/components/ui/button'
import { LayoutGridIcon, TableIcon } from 'lucide-react'

import { cn } from '#/lib/utils/cn'

import type { CatalogView } from '#/modules/catalog/lib/catalog-view'

const options = [
  { value: 'cards', label: 'Tarjetas', Icon: LayoutGridIcon },
  { value: 'table', label: 'Tabla', Icon: TableIcon },
] as const

type CatalogViewToggleProps = {
  value: CatalogView
  onChange: (view: CatalogView) => void
}

/** Segmented buttons: the pressed one is the active view. */
export function CatalogViewToggle({ value, onChange }: CatalogViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Vista del catálogo"
      className="inline-flex h-[45px] shrink-0 rounded-[9px] border border-[#eee7e0] bg-white p-1 md:h-11"
    >
      {options.map(({ value: option, label, Icon }) => (
        <Button
          key={option}
          type="button"
          variant="ghost"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'h-auto gap-1.5 rounded-[6px] px-3 text-xs font-semibold text-[#907e84] hover:bg-transparent hover:text-[#53346e] md:text-sm',
            value === option &&
              'bg-[#f3ebf8] text-[#4d2b6a] hover:bg-[#f3ebf8]',
          )}
        >
          <Icon size={15} />
          {label}
        </Button>
      ))}
    </div>
  )
}

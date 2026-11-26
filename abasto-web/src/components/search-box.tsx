import { InputClear, InputGroup } from '@ui-sdk/react/input'
import { SearchIcon, XIcon } from 'lucide-react'

import { Input } from '#/components/ui/input'

type SearchBoxProps = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}

/** Search field with a clear button. */
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
}: SearchBoxProps) {
  return (
    <InputGroup className="flex h-[45px] min-w-0 flex-[1_0_100%] items-center gap-2.5 rounded-[9px] border border-input bg-white px-[13px] text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:h-11 md:flex-1">
      <SearchIcon size={19} aria-hidden className="shrink-0" />
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full rounded-none border-0 bg-transparent px-0 text-xs text-ink-heading focus-visible:border-0 focus-visible:ring-0 md:text-xs wide:text-sm dark:bg-transparent"
      />
      <InputClear
        aria-label="Limpiar búsqueda"
        className="flex shrink-0 items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <XIcon size={16} aria-hidden />
      </InputClear>
    </InputGroup>
  )
}

import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ActionButton } from '#/modules/reports/components/report-buttons'

type ExcelMenuProps = {
  /** One of the two files is being built. */
  busy: boolean
  disabled: boolean
  onDownload: (kind: 'daily' | 'boxes') => void
}

const item =
  'flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink-row hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring'

/** "Descargar Excel": opens the choice between the two month files. */
export function ExcelMenu({ busy, disabled, onDownload }: ExcelMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = ({ target }: PointerEvent) => {
      if (!root.current?.contains(target as Node)) setOpen(false)
    }
    const onKey = ({ key }: KeyboardEvent) => {
      if (key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (kind: 'daily' | 'boxes') => {
    setOpen(false)
    onDownload(kind)
  }

  return (
    <div ref={root} className="relative">
      <ActionButton
        tone="primary"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="resultados-excel"
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? 'Generando…' : 'Descargar Excel'}
        <ChevronDownIcon size={16} aria-hidden />
      </ActionButton>
      {open && (
        <ul
          id="resultados-excel"
          role="menu"
          aria-label="Descargar Excel"
          className="absolute top-[calc(100%+6px)] right-0 z-20 w-[230px] rounded-xl border border-border bg-white p-1.5 shadow-[0_8px_24px_#2a1c3622] max-[640px]:right-auto max-[640px]:left-0"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => pick('daily')}
            >
              Venta y ganancia diaria
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => pick('boxes')}
            >
              Cajas por producto
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

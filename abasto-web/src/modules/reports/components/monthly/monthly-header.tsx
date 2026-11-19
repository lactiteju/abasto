import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '#/lib/utils/cn'
import { monthHeading } from '#/modules/reports/components/monthly/monthly-format'
import { toolbarControl } from '#/modules/reports/components/owner/owner-toolbar'
import { ActionButton } from '#/modules/reports/components/report-buttons'
import type {
  ReportSupplier,
  ReportWarehouse,
} from '#/modules/reports/types/reports'

type MonthlyHeaderProps = {
  month: string
  /** The current month: the stepper cannot go past it. */
  currentMonth: string
  scope: string
  warehouses: Array<ReportWarehouse>
  suppliers: Array<ReportSupplier>
  warehouseId?: string
  supplierId?: string
  /** A manager picks among their own warehouses only: no "all" choice. */
  managed: boolean
  busy: 'xlsx' | 'pdf' | null
  /** Nothing to download yet. */
  canDownload: boolean
  error?: string
  onMonth: (step: 1 | -1) => void
  onWarehouse: (id: string | undefined) => void
  onSupplier: (id: string | undefined) => void
  onDownload: (kind: 'xlsx' | 'pdf') => void
}

const select = cn(toolbarControl, 'max-md:min-h-11')

/** Title, month stepper, filters and the two downloads. */
export function MonthlyHeader({
  month,
  currentMonth,
  scope,
  warehouses,
  suppliers,
  warehouseId,
  supplierId,
  managed,
  busy,
  canDownload,
  error,
  onMonth,
  onWarehouse,
  onSupplier,
  onDownload,
}: MonthlyHeaderProps) {
  const step =
    'inline-flex size-11 items-center justify-center rounded-md text-ink-row hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent min-[820px]:size-9'
  return (
    <div className="mb-[22px] grid gap-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3.5">
        <div className="mr-auto grid w-full gap-1 min-[820px]:w-auto">
          <h1 className="text-[30px] leading-[1.2] font-bold tracking-[-1px]">
            Resultados del mes
          </h1>
          <p className="text-[13px] text-muted-foreground">{scope}</p>
        </div>
        <div
          role="group"
          aria-label="Mes"
          className="inline-flex items-center rounded-[9px] border border-[#e6dfeb] bg-white p-[3px]"
        >
          <button
            type="button"
            aria-label="Mes anterior"
            className={step}
            onClick={() => onMonth(-1)}
          >
            <ChevronLeftIcon size={18} aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="min-w-[132px] px-2 text-center text-[13px] font-[650] text-ink-figure"
          >
            {monthHeading(month)}
          </span>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={month >= currentMonth}
            className={step}
            onClick={() => onMonth(1)}
          >
            <ChevronRightIcon size={18} aria-hidden />
          </button>
        </div>
        {(!managed || warehouses.length > 1) && (
          <select
            aria-label="Almacén del reporte"
            value={
              managed
                ? (warehouseId ?? warehouses.at(0)?.id ?? '')
                : (warehouseId ?? '')
            }
            onChange={(event) => onWarehouse(event.target.value || undefined)}
            className={select}
          >
            {!managed && <option value="">Todos los almacenes</option>}
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Proveedor del reporte"
          value={supplierId ?? ''}
          onChange={(event) => onSupplier(event.target.value || undefined)}
          className={select}
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.active ? item.name : `${item.name} (inactivo)`}
            </option>
          ))}
        </select>
        <div className="flex gap-2.5">
          <ActionButton
            tone="primary"
            disabled={!canDownload || busy !== null}
            onClick={() => onDownload('xlsx')}
          >
            {busy === 'xlsx' ? 'Generando…' : 'Descargar Excel'}
          </ActionButton>
          <ActionButton
            disabled={!canDownload || busy !== null}
            onClick={() => onDownload('pdf')}
          >
            {busy === 'pdf' ? 'Generando…' : 'PDF'}
          </ActionButton>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-[650] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

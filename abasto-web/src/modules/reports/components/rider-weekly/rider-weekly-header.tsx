import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { NativeSelect } from '#/components/native-select'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils/cn'
import { toolbarControl } from '#/modules/reports/components/owner/owner-toolbar'
import { ActionButton } from '#/modules/reports/components/report-buttons'
import {
  allSuppliers,
  weekHeading,
} from '#/modules/reports/lib/rider-weekly-week'
import type {
  ReportSupplier,
  ReportWarehouse,
} from '#/modules/reports/types/reports'

type RiderWeeklyHeaderProps = {
  weekStart: string
  /** Monday of the current week: the stepper cannot go past it. */
  currentWeek: string
  scope: string
  warehouses: Array<ReportWarehouse>
  suppliers: Array<ReportSupplier>
  warehouseId?: string
  /** Null: every supplier. */
  supplierId?: string | null
  busy: boolean
  canDownload: boolean
  error?: string
  onWeek: (step: 1 | -1) => void
  onWarehouse: (id: string) => void
  onSupplier: (id: string) => void
  onDownload: () => void
}

const select = cn(toolbarControl, 'min-w-44 max-md:min-h-11')

/** Title, week stepper, warehouse and supplier filters, and the Excel download. */
export function RiderWeeklyHeader({
  weekStart,
  currentWeek,
  scope,
  warehouses,
  suppliers,
  warehouseId,
  supplierId,
  busy,
  canDownload,
  error,
  onWeek,
  onWarehouse,
  onSupplier,
  onDownload,
}: RiderWeeklyHeaderProps) {
  const step =
    'size-11 rounded-md text-ink-row disabled:opacity-40 min-[820px]:size-9'
  return (
    <div className="mb-[22px] grid gap-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3.5">
        <div className="mr-auto grid w-full gap-1 min-[820px]:w-auto">
          <h1 className="text-[30px] leading-[1.2] font-bold tracking-[-1px]">
            Repartos
          </h1>
          <p className="text-[13px] text-muted-foreground">{scope}</p>
        </div>
        <div
          role="group"
          aria-label="Semana"
          className="inline-flex items-center rounded-[9px] border border-[#e6dfeb] bg-white p-[3px]"
        >
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Semana anterior"
            className={step}
            onClick={() => onWeek(-1)}
          >
            <ChevronLeftIcon size={18} aria-hidden />
          </Button>
          <span
            aria-live="polite"
            className="min-w-[210px] px-2 text-center text-[13px] font-[650] text-ink-figure"
          >
            {weekHeading(weekStart)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Semana siguiente"
            disabled={weekStart >= currentWeek}
            className={step}
            onClick={() => onWeek(1)}
          >
            <ChevronRightIcon size={18} aria-hidden />
          </Button>
        </div>
        {warehouses.length > 1 && (
          <NativeSelect
            aria-label="Almacén del reporte"
            value={warehouseId ?? ''}
            onChange={(event) => onWarehouse(event.target.value)}
            className={select}
          >
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label="Proveedor del reporte"
          value={supplierId ?? allSuppliers}
          onChange={(event) => onSupplier(event.target.value)}
          className={select}
        >
          <option value={allSuppliers}>Todos los proveedores</option>
          {suppliers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.active ? item.name : `${item.name} (inactivo)`}
            </option>
          ))}
        </NativeSelect>
        <ActionButton
          tone="primary"
          disabled={!canDownload || busy}
          onClick={onDownload}
        >
          {busy ? 'Generando…' : 'Descargar Excel'}
        </ActionButton>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-[650] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

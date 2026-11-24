import { cn } from '#/lib/utils/cn'
import type { MonthlySearch } from '#/modules/reports/lib/monthly-search'

type ReportViewSwitchProps = {
  value: 'tablero' | 'resultados' | 'repartos'
  /** Merges the view into the URL; "tablero" is the absence of `vista`. */
  onChange: (patch: Partial<MonthlySearch>) => void
}

const views: Array<{
  value: ReportViewSwitchProps['value']
  label: string
}> = [
  { value: 'tablero', label: 'Tablero' },
  { value: 'resultados', label: 'Resultados del mes' },
  { value: 'repartos', label: 'Repartos' },
]

/** "Tablero | Resultados del mes | Repartos": the views of /reportes. */
export function ReportViewSwitch({ value, onChange }: ReportViewSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Vista del reporte"
      className="mb-4 inline-flex max-w-full overflow-x-auto rounded-[9px] border border-[#e6dfeb] bg-white p-[3px]"
    >
      {views.map((view) => (
        <button
          key={view.value}
          type="button"
          aria-pressed={value === view.value}
          onClick={() =>
            onChange({
              vista: view.value === 'tablero' ? undefined : view.value,
            })
          }
          className={cn(
            'min-h-11 rounded-md px-4 py-1.5 text-[13px] whitespace-nowrap text-muted-foreground min-[820px]:min-h-9',
            value === view.value
              ? 'bg-[#3f1266] font-[650] text-white'
              : 'hover:bg-muted',
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}

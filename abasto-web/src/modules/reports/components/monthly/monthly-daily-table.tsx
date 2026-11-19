import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import { dayLabel } from '#/modules/reports/components/monthly/monthly-format'
import { buildDailySheet } from '#/modules/reports/lib/monthly-results-sheet'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

const cell =
  'px-3 py-2 text-right whitespace-nowrap tabular-nums min-[1180px]:py-1.5'
const headCell = 'sticky top-0 z-10 bg-card'
const footCell = 'sticky bottom-0 border-t border-input bg-card'
const dash = <span className="text-muted-foreground">—</span>

const money = (cents: number | null, empty: boolean) =>
  empty || cents === null ? (
    dash
  ) : (
    <span className={cn(cents < 0 && 'text-destructive')}>
      {formatCents(cents)}
    </span>
  )

/**
 * "Venta y ganancia por día": one row per day, a subtotal after each week and
 * the month at the bottom. Days that have not happened show "—".
 */
export function MonthlyDailyTable({
  results,
  today,
}: {
  results: MonthlyResults
  today: string
}) {
  const sheet = buildDailySheet(results)
  return (
    <Panel className="overflow-hidden min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:max-h-[calc(100vh-2rem)] min-[1180px]:overflow-y-auto">
      <table className="w-full border-collapse text-[13px] text-ink-row">
        <caption className="px-4 pt-4 pb-2 text-left text-[15px] font-[650] text-ink-figure">
          Venta y ganancia por día
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th
              scope="col"
              className={cn(headCell, 'px-3 py-2 text-left font-semibold')}
            >
              Fecha
            </th>
            <th scope="col" className={cn(cell, headCell, 'font-semibold')}>
              Venta
            </th>
            <th scope="col" className={cn(cell, headCell, 'font-semibold')}>
              Ganancia
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) =>
            row.kind === 'day' ? (
              <tr
                key={row.day}
                aria-current={row.day === today ? 'date' : undefined}
                className={cn(
                  'border-b border-[#f4ede3]',
                  row.day === today && 'bg-accent font-semibold',
                  row.empty && 'text-muted-foreground',
                )}
              >
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-normal min-[1180px]:py-1.5"
                >
                  {dayLabel(row.day!)}
                  {row.day === today && (
                    <span className="ml-1.5 text-xs font-[650] text-accent-foreground">
                      hoy
                    </span>
                  )}
                </th>
                <td className={cell}>{money(row.revenueCents, row.empty)}</td>
                <td className={cell}>{money(row.marginCents, row.empty)}</td>
              </tr>
            ) : (
              <tr
                key={row.label}
                className="border-b border-input bg-secondary font-semibold text-secondary-foreground"
              >
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-semibold min-[1180px]:py-1.5"
                >
                  {row.label.split(' · ')[0]}
                </th>
                <td className={cell}>{money(row.revenueCents, row.empty)}</td>
                <td className={cell}>{money(row.marginCents, row.empty)}</td>
              </tr>
            ),
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold text-ink-figure">
            <th scope="row" className={cn(footCell, 'px-3 py-3 text-left')}>
              Total del mes
            </th>
            <td className={cn(cell, footCell)}>
              {formatCents(sheet.total.revenueCents)}
            </td>
            <td className={cn(cell, footCell)}>
              {formatCents(sheet.total.marginCents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Panel>
  )
}

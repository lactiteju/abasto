import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import {
  dayLabel,
  isSunday,
} from '#/modules/reports/components/monthly/monthly-format'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import {
  boxesLabel,
  buildBoxesSheet,
} from '#/modules/reports/lib/monthly-results-sheet'
import type { MonthlyResults } from '#/modules/reports/types/monthly-results'

const head = 'sticky top-0 z-20 bg-card px-1 py-2 text-xs font-semibold'
const sticky = 'sticky left-0 z-10 bg-card'
const total = 'px-3 whitespace-nowrap text-right'
const faint = <span className="text-muted-foreground">—</span>

/**
 * "Cajas por producto" as the client's grid: product × day numbers in catalog
 * order, the product column and the day header stay in view while the card
 * scrolls. Past days without sales are blank, days to come show "—".
 */
export function MonthlyProductsTable({
  results,
  unsold,
}: {
  results: MonthlyResults
  /** Also list products that sold nothing in the month. */
  unsold: boolean
}) {
  const sheet = buildBoxesSheet(results, { unsold })
  return (
    <Panel className="overflow-hidden">
      <div
        tabIndex={0}
        role="region"
        aria-label="Cajas por producto y día"
        className="max-h-[75vh] overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs text-ink-row tabular-nums">
          <caption className="sr-only">
            Cajas vendidas por producto y día
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  head,
                  sticky,
                  'z-30 min-w-[168px] pl-4 text-left',
                )}
              >
                Producto
              </th>
              {sheet.dayHeaders.map((header, column) => (
                <th
                  key={results.days[column]}
                  scope="col"
                  title={dayLabel(results.days[column])}
                  className={cn(
                    head,
                    'min-w-[30px] text-center text-muted-foreground',
                    isSunday(results.days[column]) && 'bg-muted',
                  )}
                >
                  {header}
                </th>
              ))}
              <th scope="col" className={cn(head, total, 'min-w-[72px]')}>
                Total cajas
              </th>
              <th scope="col" className={cn(head, total, 'min-w-[96px]')}>
                Gan. / caja
              </th>
              <th scope="col" className={cn(head, total, 'min-w-[104px] pr-4')}>
                Ganancia
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => (
              <tr key={row.productId} className="group/row">
                <th
                  scope="row"
                  className={cn(
                    sticky,
                    'max-w-[220px] border-t border-[#f4ede3] py-1.5 pr-2 pl-4 text-left font-normal group-hover/row:bg-muted',
                  )}
                >
                  <span
                    title={row.name}
                    className="block truncate text-[13px] font-[650] text-ink-figure"
                  >
                    {row.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.boxName}
                  </span>
                </th>
                {row.boxesByDay.map((boxes, column) => (
                  <td
                    key={results.days[column]}
                    className={cn(
                      'border-t border-[#f4ede3] px-0.5 text-center group-hover/row:bg-muted',
                      isSunday(results.days[column]) && 'bg-muted',
                    )}
                  >
                    {sheet.futureDays[column]
                      ? faint
                      : boxes
                        ? boxesLabel(boxes)
                        : null}
                  </td>
                ))}
                <td
                  className={cn(
                    total,
                    'border-t border-[#f4ede3] font-[650] group-hover/row:bg-muted',
                    row.boxes === 0 && 'text-muted-foreground',
                  )}
                >
                  {boxesLabel(row.boxes)}
                </td>
                <td
                  className={cn(
                    total,
                    'border-t border-[#f4ede3] group-hover/row:bg-muted',
                  )}
                >
                  {row.marginPerBoxCents === null
                    ? faint
                    : formatCents(row.marginPerBoxCents)}
                </td>
                <td
                  className={cn(
                    total,
                    'border-t border-[#f4ede3] pr-4 font-bold text-ink-figure group-hover/row:bg-muted',
                    row.marginCents < 0 && 'text-destructive',
                  )}
                >
                  {formatCents(row.marginCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold text-ink-figure">
              <th
                scope="row"
                className={cn(
                  sticky,
                  'sticky bottom-0 z-20 border-t border-input py-2.5 pr-2 pl-4 text-left',
                )}
              >
                Total cajas vendidas
              </th>
              {sheet.dayTotals.map((value, column) => (
                <td
                  key={results.days[column]}
                  className={cn(
                    'sticky bottom-0 border-t border-input bg-card px-0.5 text-center',
                    isSunday(results.days[column]) && 'bg-muted',
                  )}
                >
                  {sheet.futureDays[column]
                    ? faint
                    : value
                      ? boxesLabel(value)
                      : null}
                </td>
              ))}
              <td
                className={cn(
                  total,
                  'sticky bottom-0 border-t border-input bg-card',
                )}
              >
                {boxesLabel(sheet.totalBoxes)}
              </td>
              <td className="sticky bottom-0 border-t border-input bg-card" />
              <td
                className={cn(
                  total,
                  'sticky bottom-0 border-t border-input bg-card pr-4',
                )}
              >
                {formatCents(sheet.totalMarginCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}

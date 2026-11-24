import type { ReactNode } from 'react'

import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import {
  numericCell,
  Panel,
  PlainTable,
} from '#/modules/reports/components/owner/owner-panel'
import type {
  SheetMetrics,
  WeeklySheet,
} from '#/modules/reports/lib/rider-weekly-sheet'

const pieces = new Intl.NumberFormat('es-MX')
const riderHeads = ['Pzas', 'Venta', 'Gan. depósito', 'Gan. ruta']
const totalHeads = ['Pzas', 'Merma', 'Gan. depósito', 'Gan. ruta', 'Gan. total']
const groupEdge = 'border-l border-[#f0e8f5]'

const money = (cents: number) => (
  <span className={cn(cents < 0 && 'text-destructive')}>
    {formatCents(cents)}
  </span>
)

/** A quiet dash in place of a zero in the product rows. */
const orDash = (value: number, shown: ReactNode, plain: boolean) =>
  value === 0 && !plain ? (
    <span className="text-muted-foreground/60">—</span>
  ) : (
    shown
  )

function RiderCells({
  id,
  metrics,
  plain,
}: {
  id: string
  metrics: SheetMetrics
  plain: boolean
}) {
  return (
    <>
      <td key={`${id}-u`} className={cn(numericCell, groupEdge)}>
        {orDash(metrics.units, pieces.format(metrics.units), plain)}
      </td>
      <td key={`${id}-v`} className={numericCell}>
        {orDash(metrics.revenueCents, money(metrics.revenueCents), plain)}
      </td>
      <td key={`${id}-d`} className={numericCell}>
        {orDash(metrics.revenueCents, money(metrics.depotProfitCents), plain)}
      </td>
      <td key={`${id}-r`} className={numericCell}>
        {orDash(
          metrics.routeProfitCents,
          money(metrics.routeProfitCents),
          plain,
        )}
      </td>
    </>
  )
}

function TotalCells({
  line,
  plain,
}: {
  line: WeeklySheet['totals']
  plain: boolean
}) {
  return (
    <>
      <td className={cn(numericCell, groupEdge, 'font-[650]')}>
        {orDash(line.totalUnits, pieces.format(line.totalUnits), plain)}
      </td>
      <td className={numericCell}>
        {orDash(line.scrapUnits, pieces.format(line.scrapUnits), plain)}
      </td>
      <td className={numericCell}>
        {orDash(line.revenueCents, money(line.depotProfitCents), plain)}
      </td>
      <td className={numericCell}>
        {orDash(line.routeProfitCents, money(line.routeProfitCents), plain)}
      </td>
      <td className={cn(numericCell, 'font-[650]')}>
        {orDash(line.revenueCents, money(line.totalProfitCents), plain)}
      </td>
    </>
  )
}

/**
 * Per product: SKU, name, then Pzas · Venta · Gan. depósito · Gan. ruta for
 * each rider and the totals, with a totals row. Zeros print as quiet dashes.
 */
export function RiderWeeklyTable({ sheet }: { sheet: WeeklySheet }) {
  return (
    <Panel className="grid gap-3 px-4 py-4 min-[820px]:px-5 min-[820px]:py-5">
      <h2
        id="repartos-productos"
        className="text-[15px] font-[650] text-ink-figure"
      >
        Productos
      </h2>
      <PlainTable aria-labelledby="repartos-productos">
        <thead>
          <tr>
            <th rowSpan={2} className="min-w-[84px]">
              SKU
            </th>
            <th rowSpan={2} className="min-w-[180px]">
              Producto
            </th>
            {sheet.riders.map((rider) => (
              <th
                key={rider.id}
                colSpan={riderHeads.length}
                className={cn(groupEdge, 'text-center whitespace-nowrap')}
              >
                {rider.label}
              </th>
            ))}
            <th
              colSpan={totalHeads.length}
              className={cn(groupEdge, 'text-center')}
            >
              Total
            </th>
          </tr>
          <tr>
            {sheet.riders.flatMap((rider) =>
              riderHeads.map((label, index) => (
                <th
                  key={`${rider.id}-${label}`}
                  className={cn(numericCell, index === 0 && groupEdge)}
                >
                  {label}
                </th>
              )),
            )}
            {totalHeads.map((label, index) => (
              <th
                key={label}
                className={cn(numericCell, index === 0 && groupEdge)}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <tr key={row.productId}>
              <td className="text-muted-foreground">{row.sku}</td>
              <td className="font-[550] text-ink-figure">{row.name}</td>
              {row.byRider.map((metrics, index) => (
                <RiderCells
                  key={sheet.riders[index].id}
                  id={sheet.riders[index].id}
                  metrics={metrics}
                  plain={false}
                />
              ))}
              <TotalCells line={row} plain={false} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold text-ink-figure [&>td]:border-t [&>td]:border-border">
            <td />
            <td>Total</td>
            {sheet.totals.byRider.map((metrics, index) => (
              <RiderCells
                key={sheet.riders[index].id}
                id={sheet.riders[index].id}
                metrics={metrics}
                plain
              />
            ))}
            <TotalCells line={sheet.totals} plain />
          </tr>
        </tfoot>
      </PlainTable>
    </Panel>
  )
}

import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import type { SheetMetrics } from '#/modules/reports/lib/rider-weekly-sheet'

export type RiderCard = {
  id: string
  name: string
  metrics: SheetMetrics
  /** The sum of every route. */
  total?: boolean
}

const pieces = new Intl.NumberFormat('es-MX')

/** One card per rider and a total one: sale, pieces, both profits and merma. */
export function RiderWeeklyCards({ cards }: { cards: Array<RiderCard> }) {
  return (
    <ul
      aria-label="Resumen por ruta"
      className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
    >
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <Panel
            className={cn(
              'grid h-full content-start gap-3 px-[18px] py-4',
              card.total && 'border-[#d9c9e8] bg-[#faf6fd]',
            )}
          >
            <h3 className="truncate text-[15px] font-[650] text-ink-figure">
              {card.name}
            </h3>
            <div>
              <div className="text-[13px] text-muted-foreground">Venta</div>
              <div className="text-[26px] leading-[1.15] font-bold tracking-[-0.8px] text-ink-figure tabular-nums">
                {formatCents(card.metrics.revenueCents)}
              </div>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
              <Row label="Piezas" value={pieces.format(card.metrics.units)} />
              <Row
                label="Gan. depósito"
                value={formatCents(card.metrics.depotProfitCents)}
                negative={card.metrics.depotProfitCents < 0}
              />
              <Row
                label="Gan. ruta"
                value={formatCents(card.metrics.routeProfitCents)}
              />
              <Row
                label="Merma"
                value={`${pieces.format(card.metrics.scrapUnits)} pzas`}
                quiet={card.metrics.scrapUnits === 0}
              />
            </dl>
          </Panel>
        </li>
      ))}
    </ul>
  )
}

function Row({
  label,
  value,
  negative,
  quiet,
}: {
  label: string
  value: string
  negative?: boolean
  quiet?: boolean
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-right font-[650] text-ink-row tabular-nums',
          negative && 'text-destructive',
          quiet && 'font-normal text-muted-foreground',
        )}
      >
        {value}
      </dd>
    </>
  )
}

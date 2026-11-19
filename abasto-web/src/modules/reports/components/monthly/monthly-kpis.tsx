import { cn } from '#/lib/utils/cn'
import { formatBpsPercent } from '#/modules/executive/lib/format'
import { formatCents } from '#/modules/pricing/lib/money'
import { Figure, Panel } from '#/modules/reports/components/owner/owner-panel'
import { boxesLabel } from '#/modules/reports/lib/monthly-results-sheet'
import { marginBps } from '#/modules/reports/components/monthly/monthly-format'
import { relativeChangeBps } from '#/modules/reports/lib/owner-series'
import type { MonthlyTotals } from '#/modules/reports/types/monthly-results'

type MonthlyKpisProps = {
  totals: MonthlyTotals
  previous: MonthlyTotals
  /** "octubre": the month the deltas compare with. */
  previousName: string
}

/** Venta, Ganancia, Margen and Cajas, each against the whole previous month. */
export function MonthlyKpis({
  totals,
  previous,
  previousName,
}: MonthlyKpisProps) {
  const hasPrevious = previous.orders > 0
  const note = (change: React.ReactNode) =>
    hasPrevious ? (
      <>
        {change} vs. {previousName}
      </>
    ) : (
      `Sin ventas en ${previousName}`
    )
  const currentBps = marginBps(totals.marginCents, totals.revenueCents)
  const previousMarginBps = marginBps(
    previous.marginCents,
    previous.revenueCents,
  )
  return (
    <Panel
      role="group"
      aria-label="Resumen del mes"
      className="grid grid-cols-2 gap-y-5 py-5 min-[820px]:grid-cols-4 [&>*]:px-[22px] [&>*:nth-child(odd)]:max-[819px]:border-r [&>*:nth-child(odd)]:max-[819px]:border-border min-[820px]:[&>*+*]:border-l min-[820px]:[&>*+*]:border-border"
    >
      <Figure
        label="Venta"
        size="lg"
        value={formatCents(totals.revenueCents)}
        note={note(
          <Delta
            bps={relativeChangeBps(totals.revenueCents, previous.revenueCents)}
          />,
        )}
      />
      <Figure
        label="Ganancia"
        size="lg"
        tone={totals.marginCents < 0 ? 'negative' : undefined}
        value={formatCents(totals.marginCents)}
        note={note(
          <Delta
            bps={relativeChangeBps(totals.marginCents, previous.marginCents)}
          />,
        )}
      />
      <Figure
        label="Margen"
        size="lg"
        value={formatBpsPercent(currentBps)}
        note={note(<Delta bps={currentBps - previousMarginBps} points />)}
      />
      <Figure
        label="Cajas vendidas"
        size="lg"
        value={boxesLabel(totals.boxes)}
        note={note(
          <Delta bps={relativeChangeBps(totals.boxes, previous.boxes)} />,
        )}
      />
    </Panel>
  )
}

/** ▲ 12.4 % / ▼ 3.0 %; for the margin the change is in percentage points. */
function Delta({ bps, points }: { bps: number | null; points?: boolean }) {
  if (bps === null) return null
  if (bps === 0) return <span className="font-[650]">Igual</span>
  const size = Math.abs(bps / 100)
  const text = `${size.toFixed(size < 10 ? 1 : 0)} ${points ? 'pts' : '%'}`
  return (
    <span
      className={cn(
        'font-[650]',
        bps > 0 ? 'text-[#1d7a4b]' : 'text-destructive',
      )}
    >
      <span aria-hidden="true">{bps > 0 ? '▲' : '▼'}</span>
      <span className="sr-only">{bps > 0 ? 'Subió' : 'Bajó'}</span> {text}
    </span>
  )
}

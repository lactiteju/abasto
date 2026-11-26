import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import {
  compactPesos,
  niceTicks,
  percentText,
} from '#/modules/reports/components/monthly/monthly-chart-math'
import {
  boxesText,
  dayLabel,
  marginBps,
  monthLabel,
} from '#/modules/reports/components/monthly/monthly-format'
import { useElementWidth } from '#/modules/reports/components/monthly/use-element-width'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import {
  longDateLabel,
  weekStart,
} from '#/modules/reports/lib/monthly-results-sheet'
import type {
  MonthlyDay,
  MonthlyResults,
} from '#/modules/reports/types/monthly-results'

const height = 300
const pad = { top: 14, right: 12, bottom: 58, left: 58 }
/** Narrowest slot per day: a 44px touch target, so a phone scrolls the card. */
const slotMin = 44
const plotHeight = height - pad.top - pad.bottom
/**
 * Bars grow from the baseline: `starting:` is their first style, so a bar
 * that already exists never replays. The scrub tooltip and hover add no motion.
 */
const barGrow =
  'origin-bottom [transform-box:fill-box] transition-[scale,opacity] duration-300 ease-(--ease-out) starting:scale-y-0 starting:opacity-0 motion-reduce:starting:scale-y-100'

/** The first 8 days step by one stagger; later bars grow with the eighth. */
const barDelay = (index: number) => ({
  transitionDelay: `calc(min(${index}, 7) * var(--stagger))`,
})

type Props = { results: MonthlyResults; today: string }

/**
 * "Venta por día": one slot per business day with a venta bar and a ganancia
 * bar. Days after `through` are a faint baseline tick; dashed lines open weeks.
 */
export function MonthlyDailyChart({ results, today }: Props) {
  const { days, byDay, through } = results
  const [ref, measured] = useElementWidth<HTMLDivElement>(1000)
  const [active, setActive] = useState<string | undefined>()
  // A phone gets 44px touch targets and scrolls the card; wider screens fit.
  const slotFloor = measured < 700 ? slotMin : 26
  const minWidth = days.length * slotFloor + pad.left + pad.right
  const width = Math.max(measured, minWidth)
  const slot = (width - pad.left - pad.right) / days.length
  const top = Math.max(
    0,
    ...byDay.map((item) => Math.max(item.revenueCents, item.marginCents)),
  )
  const { ticks, top: axisTop } = niceTicks(top / 100)
  const y = (pesos: number) => pad.top + plotHeight * (1 - pesos / axisTop)
  const barWidth = Math.min(20, slot * 0.34)
  const activeIndex = active ? days.indexOf(active) : -1
  const activeDay = activeIndex >= 0 ? byDay[activeIndex] : undefined
  const phone = measured < 700
  // On a phone the card opens at today (or the last day with data).
  useEffect(() => {
    const scroller = ref.current
    if (!scroller || scroller.clientWidth >= 700) return
    const at = days.indexOf(today)
    const target =
      at >= 0 ? at : days.filter((day) => day <= through).length - 1
    const slotWidth =
      (scroller.scrollWidth - pad.left - pad.right) / days.length
    scroller.scrollLeft = Math.max(
      0,
      pad.left + slotWidth * (target + 0.5) - scroller.clientWidth / 2,
    )
  }, [ref, days, today, through])
  const best = byDay.reduce<MonthlyDay | undefined>(
    (winner, item) =>
      item.revenueCents > (winner?.revenueCents ?? 0) ? item : winner,
    undefined,
  )
  const summary = [
    `Venta y ganancia por día de ${monthLabel(results.month)}.`,
    `Venta del mes ${formatCents(results.totals.revenueCents)}, ganancia ${formatCents(results.totals.marginCents)}.`,
    best &&
      `Mejor día: ${longDateLabel(best.day)}, ${formatCents(best.revenueCents)}.`,
    'Usa las flechas izquierda y derecha para recorrer los días.',
  ]
    .filter(Boolean)
    .join(' ')

  const onKey = (event: KeyboardEvent) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (event.key === 'Escape') setActive(undefined)
    if (!step) return
    event.preventDefault()
    const last = days.filter((day) => day <= through).length - 1
    if (last < 0) return
    const from = activeIndex < 0 ? (step > 0 ? -1 : last + 1) : activeIndex
    setActive(days[Math.min(Math.max(from + step, 0), last)])
  }

  const centre = (index: number) => pad.left + slot * (index + 0.5)
  const flip = activeIndex >= 0 && centre(activeIndex) > width * 0.6
  const compact = slot < 52

  return (
    <Panel className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4 min-[820px]:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2
          id="resultados-dias"
          className="text-[15px] font-[650] text-ink-figure"
        >
          Venta por día
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-row">
          <Swatch className="bg-primary">Venta</Swatch>
          <Swatch className="bg-secondary-foreground">Ganancia</Swatch>
          <Swatch className="bg-accent ring-1 ring-primary/40">Hoy</Swatch>
          <Swatch className="h-3 w-0 rounded-none border-l border-dashed border-ink-muted">
            Semana nueva
          </Swatch>
        </ul>
      </div>
      {/* A phone scrolls the card to reach every day, never the page. */}
      <div ref={ref} className="overflow-x-auto overscroll-x-contain">
        <div
          role="group"
          aria-labelledby="resultados-dias"
          aria-description={summary}
          tabIndex={0}
          onKeyDown={onKey}
          onMouseLeave={() => setActive(undefined)}
          className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ minWidth }}
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="block text-[11px] tabular-nums"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? 'stroke-input' : 'stroke-border'}
                />
                <text
                  x={pad.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-ink-muted"
                >
                  {compactPesos(tick * 100)}
                </text>
              </g>
            ))}
            {days.map((day, index) => {
              const item = byDay[index]
              const future = day > through
              const x = pad.left + slot * index
              const cx = centre(index)
              const isToday = day === today
              const newWeek =
                index > 0 && weekStart(day) !== weekStart(days[index - 1])
              const sold = !future && item.orders > 0
              const label = dayLabel(day)
              const [weekday, date] = label.split(' ')
              const labelClass = isToday
                ? 'fill-accent-foreground font-bold'
                : future
                  ? 'fill-ink-muted'
                  : 'fill-ink-row'
              const labelY = pad.top + plotHeight + 18
              return (
                <g key={day}>
                  {isToday && (
                    <rect
                      x={x + 1}
                      y={pad.top}
                      width={slot - 2}
                      height={plotHeight}
                      rx={4}
                      className="fill-accent"
                    />
                  )}
                  {future && (
                    <line
                      x1={cx - 4}
                      x2={cx + 4}
                      y1={y(0) - 1}
                      y2={y(0) - 1}
                      strokeWidth={2}
                      strokeLinecap="round"
                      className="stroke-border"
                    />
                  )}
                  {day === active && !isToday && (
                    <rect
                      x={x + 1}
                      y={pad.top}
                      width={slot - 2}
                      height={plotHeight}
                      rx={4}
                      className="fill-secondary"
                    />
                  )}
                  {newWeek && (
                    <line
                      x1={x}
                      x2={x}
                      y1={pad.top}
                      y2={pad.top + plotHeight + 6}
                      strokeDasharray="3 4"
                      className="stroke-ink-faint"
                    />
                  )}
                  {sold && (
                    <>
                      <rect
                        x={cx - barWidth - 1}
                        y={y(Math.max(0, item.revenueCents) / 100)}
                        width={barWidth}
                        height={Math.max(
                          2,
                          y(0) - y(Math.max(0, item.revenueCents) / 100),
                        )}
                        rx={2}
                        style={barDelay(index)}
                        className={cn('fill-primary', barGrow)}
                      />
                      <rect
                        x={cx + 1}
                        y={y(Math.max(0, item.marginCents) / 100)}
                        width={barWidth}
                        height={Math.max(
                          2,
                          y(0) - y(Math.max(0, item.marginCents) / 100),
                        )}
                        rx={2}
                        style={barDelay(index)}
                        className={cn('fill-secondary-foreground', barGrow)}
                      />
                    </>
                  )}
                  {!future && !sold && (
                    <line
                      x1={cx - barWidth}
                      x2={cx + barWidth}
                      y1={y(0) - 1}
                      y2={y(0) - 1}
                      strokeWidth={2}
                      strokeLinecap="round"
                      className="stroke-input"
                    />
                  )}
                  <text
                    x={cx}
                    y={labelY}
                    textAnchor="middle"
                    className={labelClass}
                  >
                    {compact ? weekday : label}
                  </text>
                  {compact && (
                    <text
                      x={cx}
                      y={labelY + 14}
                      textAnchor="middle"
                      className={labelClass}
                    >
                      {date}
                    </text>
                  )}
                  {isToday && (
                    <text
                      x={cx}
                      y={labelY + (compact ? 28 : 14)}
                      textAnchor="middle"
                      className="fill-accent-foreground text-[10px] font-bold"
                    >
                      HOY
                    </text>
                  )}
                  {/* One touch-sized target per day (at least 44px wide). */}
                  <rect
                    x={x}
                    y={pad.top}
                    width={slot}
                    height={plotHeight + pad.bottom - 10}
                    fill="transparent"
                    onMouseEnter={() => !future && setActive(day)}
                    onClick={() =>
                      !future && setActive(active === day ? undefined : day)
                    }
                  />
                </g>
              )
            })}
          </svg>
          {activeDay && (
            <DayTooltip
              day={activeDay}
              left={centre(activeIndex)}
              flip={flip}
            />
          )}
        </div>
      </div>
      {phone && (
        <p className="text-xs text-ink-muted">
          Desliza el gráfico para ver todos los días.
        </p>
      )}
      <div className="sr-only">
        <table>
          <caption>
            Venta, ganancia y cajas por día de {monthLabel(results.month)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Venta</th>
              <th scope="col">Ganancia</th>
              <th scope="col">Cajas</th>
            </tr>
          </thead>
          <tbody>
            {byDay.map((item) => (
              <tr key={item.day}>
                <th scope="row">{longDateLabel(item.day)}</th>
                {item.day > through ? (
                  <td colSpan={3}>Aún no llega</td>
                ) : (
                  <>
                    <td>{formatCents(item.revenueCents)}</td>
                    <td>{formatCents(item.marginCents)}</td>
                    <td>{boxesText(item.boxes)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Swatch({
  className,
  children,
}: {
  className: string
  children: string
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn('size-2.5 rounded-[3px]', className)}
      />
      {children}
    </li>
  )
}

function DayTooltip({
  day,
  left,
  flip,
}: {
  day: MonthlyDay
  left: number
  flip: boolean
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-3 z-10 w-64 rounded-[10px] border border-border bg-card px-3 py-2.5 text-xs text-ink-row shadow-[0_6px_18px_#2a1c3622]"
      style={{
        left,
        transform: `translateX(${flip ? 'calc(-100% - 14px)' : '14px'})`,
      }}
    >
      <p className="mb-1.5 text-[13px] font-[650] text-ink-figure first-letter:uppercase">
        {longDateLabel(day.day)}
      </p>
      {day.orders > 0 ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
          <Row
            label="Venta"
            value={formatCents(day.revenueCents)}
            dot="bg-primary"
          />
          <Row
            label="Ganancia"
            value={formatCents(day.marginCents)}
            dot="bg-secondary-foreground"
          />
          <Row
            label="Margen"
            value={percentText(
              marginBps(day.marginCents, day.revenueCents) / 100,
            )}
          />
          <Row label="Cajas" value={boxesText(day.boxes)} />
        </dl>
      ) : (
        <p className="text-muted-foreground">Sin ventas este día.</p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  dot,
}: {
  label: string
  value: string
  dot?: string
}) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {dot && (
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-[2px]', dot)}
          />
        )}
        {label}
      </dt>
      <dd className="text-right font-[650] text-ink-figure">{value}</dd>
    </>
  )
}

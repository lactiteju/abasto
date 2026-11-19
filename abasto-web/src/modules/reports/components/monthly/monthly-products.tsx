import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import {
  barHeight,
  barTooltip,
  dayLabel,
  isSunday,
} from '#/modules/reports/components/monthly/monthly-format'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import { TextLink } from '#/modules/reports/components/report-buttons'
import {
  boxesLabel,
  dayHeader,
} from '#/modules/reports/lib/monthly-results-sheet'
import type {
  MonthlyProductRow,
  MonthlyResults,
} from '#/modules/reports/types/monthly-results'

/** Rows shown before "Ver todos". */
export const topProducts = 15

type MonthlyProductsProps = {
  results: MonthlyResults
  /** Product shown open at first; the rest start closed. */
  initialOpen?: string
}

/** "Cajas por producto", ranked by margin, with a micro-bar per day. */
export function MonthlyProducts({
  results,
  initialOpen,
}: MonthlyProductsProps) {
  const [open, setOpen] = useState<string | undefined>(initialOpen)
  const [all, setAll] = useState(false)
  const { products } = results
  const shown = all ? products : products.slice(0, topProducts)
  return (
    <section
      aria-labelledby="resultados-cajas"
      className="grid min-w-0 gap-3 @container"
    >
      <div className="grid gap-1">
        <h2
          id="resultados-cajas"
          className="text-[15px] font-[650] text-ink-figure"
        >
          Cajas por producto
        </h2>
        <p className="text-[13px] text-muted-foreground">
          De mayor a menor ganancia. Cada barra es un día y su altura se mide
          contra el mejor día de ese producto; las franjas grises son domingos.
        </p>
      </div>
      <Panel className="overflow-hidden">
        <div
          aria-hidden="true"
          className="hidden border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground @[860px]:grid @[860px]:grid-cols-[200px_minmax(0,1fr)_300px] @[860px]:gap-4"
        >
          <span>Producto</span>
          <span>Día a día</span>
          <span className="grid grid-cols-[64px_100px_1fr] text-right">
            <span>Cajas</span>
            <span>Gan. / caja</span>
            <span>Ganancia</span>
          </span>
        </div>
        <ul>
          {shown.map((product) => (
            <ProductRow
              key={product.productId}
              product={product}
              results={results}
              open={open === product.productId}
              onToggle={() =>
                setOpen(
                  open === product.productId ? undefined : product.productId,
                )
              }
            />
          ))}
        </ul>
        {products.length > topProducts && (
          <div className="border-t border-border px-4 py-1">
            <TextLink
              className="min-h-11"
              aria-expanded={all}
              onClick={() => setAll((value) => !value)}
            >
              {all
                ? `Ver los ${topProducts} primeros`
                : `Ver todos (${products.length})`}
            </TextLink>
          </div>
        )}
      </Panel>
    </section>
  )
}

function ProductRow({
  product,
  results,
  open,
  onToggle,
}: {
  product: MonthlyProductRow
  results: MonthlyResults
  open: boolean
  onToggle: () => void
}) {
  const panel = `resultados-dias-${product.productId}`
  return (
    <li className="border-b border-[#f4ede3] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={onToggle}
        className="group/row grid w-full gap-x-4 gap-y-2.5 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 @[860px]:grid-cols-[200px_minmax(0,1fr)_300px] @[860px]:items-center"
      >
        <span className="flex min-w-0 items-start gap-2">
          <ChevronDownIcon
            size={16}
            aria-hidden
            className={cn(
              'mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200',
              !open && '-rotate-90',
            )}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-[650] text-ink-figure">
              {product.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {product.sku} · {product.boxName}
            </span>
          </span>
        </span>
        <BarStrip product={product} results={results} />
        <span className="grid grid-cols-3 gap-x-3 text-right text-sm text-ink-row tabular-nums @[860px]:grid-cols-[64px_100px_1fr] @[860px]:gap-x-0">
          <Total label="Cajas" value={boxesLabel(product.boxes)} />
          <Total
            label="Gan. / caja"
            value={
              product.marginPerBoxCents === null
                ? '—'
                : formatCents(product.marginPerBoxCents)
            }
          />
          <Total
            label="Ganancia"
            value={formatCents(product.marginCents)}
            strong
            negative={product.marginCents < 0}
          />
        </span>
      </button>
      {open && <ExactDays product={product} results={results} id={panel} />}
    </li>
  )
}

function Total({
  label,
  value,
  strong,
  negative,
}: {
  label: string
  value: string
  strong?: boolean
  negative?: boolean
}) {
  return (
    <span className="block">
      <small className="block text-[11px] text-muted-foreground @[860px]:hidden">
        {label}
      </small>
      <span
        className={cn(
          strong && 'font-bold text-ink-figure',
          negative && 'text-destructive',
        )}
      >
        {value}
      </span>
    </span>
  )
}

/**
 * One column per day. Heights follow the product's own busiest day, so every
 * row shows its shape; the figures on the right carry the size.
 */
function BarStrip({
  product,
  results,
}: {
  product: MonthlyProductRow
  results: MonthlyResults
}) {
  const max = Math.max(0, ...Object.values(product.boxesByDay))
  return (
    // On a phone the strip scrolls inside its row, never the page.
    <span
      aria-hidden="true"
      className="block max-w-full overflow-x-auto max-md:pb-1 md:overflow-visible"
    >
      <span
        className="grid h-9 grid-flow-col auto-cols-fr gap-0.5"
        style={{ minWidth: `${results.days.length * 9}px` }}
      >
        {results.days.map((day) => {
          const future = day > results.through
          const boxes = product.boxesByDay[day] ?? 0
          return (
            <span
              key={day}
              className={cn(
                'group/bar relative flex items-end rounded-[3px]',
                isSunday(day) && 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'block w-full rounded-t-[2px]',
                  future
                    ? 'h-[3px] bg-border'
                    : boxes > 0
                      ? 'bg-secondary-foreground group-hover/bar:bg-primary'
                      : 'h-px bg-input',
                )}
                style={
                  boxes > 0 && !future
                    ? { height: `${barHeight(boxes, max)}%` }
                    : undefined
                }
              />
              {!future && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink-figure px-2 py-1 text-xs whitespace-nowrap text-white shadow-[0_4px_12px_#2a1c3622] md:group-hover/bar:block">
                  {barTooltip(day, boxes)}
                </span>
              )}
            </span>
          )
        })}
      </span>
    </span>
  )
}

/** Exact boxes of the product on every day of the month. */
function ExactDays({
  product,
  results,
  id,
}: {
  product: MonthlyProductRow
  results: MonthlyResults
  id: string
}) {
  return (
    <div id={id} className="overflow-x-auto px-4 pb-4">
      <table
        className="w-full table-fixed border-collapse text-xs tabular-nums"
        style={{ minWidth: `${results.days.length * 27}px` }}
      >
        <caption className="sr-only">Cajas de {product.name} por día</caption>
        <thead>
          <tr>
            {results.days.map((day) => (
              <th
                key={day}
                scope="col"
                title={dayLabel(day)}
                className={cn(
                  'px-0.5 py-1 text-center font-semibold text-muted-foreground',
                  isSunday(day) && 'bg-muted',
                )}
              >
                {dayHeader(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {results.days.map((day) => {
              const future = day > results.through
              const boxes = product.boxesByDay[day]
              return (
                <td
                  key={day}
                  className={cn(
                    'border-t border-border px-0.5 py-1.5 text-center text-ink-row',
                    isSunday(day) && 'bg-muted',
                    (future || !boxes) && 'text-muted-foreground',
                  )}
                >
                  {future ? '—' : boxes ? boxesLabel(boxes) : '·'}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

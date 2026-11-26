import { cn } from '#/lib/utils/cn'
import { formatCents } from '#/modules/pricing/lib/money'
import {
  barShare,
  figureOf,
  listProducts,
  percentText,
  sortLabels,
} from '#/modules/reports/components/monthly/monthly-chart-math'
import type {
  ProductMetric,
  ProductSort,
} from '#/modules/reports/components/monthly/monthly-chart-math'
import {
  boxesText,
  marginBps,
} from '#/modules/reports/components/monthly/monthly-format'
import { Panel } from '#/modules/reports/components/owner/owner-panel'
import {
  TextLink,
  focusRing,
} from '#/modules/reports/components/report-buttons'
import type { MonthlyProductRow } from '#/modules/reports/types/monthly-results'

/** Rows shown before "Ver todos". */
export const topProducts = 12

const metrics: Array<{ value: ProductMetric; label: string }> = [
  { value: 'pesos', label: 'Pesos' },
  { value: 'cajas', label: 'Cajas' },
]

const notes: Record<ProductSort, string> = {
  mas: 'De la venta más alta a la más baja.',
  menos: 'De la venta más baja a la más alta, solo productos con venta.',
  ganancia: 'De la ganancia más alta a la más baja.',
  sin: 'Productos activos sin una sola venta en el mes, en el orden del catálogo.',
}

type Props = {
  products: Array<MonthlyProductRow>
  sort: ProductSort
  metric: ProductMetric
  all: boolean
  onSort: (sort: ProductSort) => void
  onMetric: (metric: ProductMetric) => void
  onAll: (all: boolean) => void
  className?: string
}

/** "Productos": chips pick the ranking, Pesos | Cajas the measure of each bar. */
export function MonthlyProductList({
  products,
  sort,
  metric,
  all,
  onSort,
  onMetric,
  onAll,
  className,
}: Props) {
  const rows = listProducts(products, sort, metric)
  const shown = all ? rows : rows.slice(0, topProducts)
  const unsold = sort === 'sin'
  const max = Math.max(0, ...rows.map((row) => figureOf(row, sort, metric)))

  return (
    <Panel
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] content-start gap-3 py-4 min-[820px]:py-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 min-[820px]:px-5">
        <h2
          id="resultados-productos"
          className="text-[15px] font-[650] text-ink-figure"
        >
          Productos
        </h2>
        <div
          role="group"
          aria-label="Medir en"
          className="inline-flex rounded-[9px] border border-[#e6dfeb] bg-white p-[3px]"
        >
          {metrics.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={metric === item.value}
              disabled={unsold}
              onClick={() => onMetric(item.value)}
              className={cn(
                focusRing,
                'min-h-11 rounded-md px-4 text-[13px] whitespace-nowrap disabled:opacity-40 min-[820px]:min-h-8',
                metric === item.value && !unsold
                  ? 'bg-[#3f1266] font-[650] text-white'
                  : 'text-muted-foreground enabled:hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="group"
        aria-label="Ordenar productos"
        className="flex flex-wrap gap-2 px-4 min-[820px]:px-5"
      >
        {sortLabels.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={sort === item.value}
            onClick={() => onSort(item.value)}
            className={cn(
              focusRing,
              'min-h-11 rounded-full border px-3.5 text-[13px] whitespace-nowrap min-[820px]:min-h-8',
              sort === item.value
                ? 'border-secondary-foreground bg-secondary font-[650] text-secondary-foreground'
                : 'border-border bg-card text-ink-row hover:bg-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="px-4 text-[13px] text-muted-foreground min-[820px]:px-5">
        {notes[sort]}
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground min-[820px]:px-5">
          {unsold
            ? 'Todos los productos activos vendieron algo este mes.'
            : 'Ningún producto vendió este mes.'}
        </p>
      ) : (
        // Rows flow down two columns from 1180px so the width is used and
        // each row stays short enough to read name → bar → value in one glance.
        <ul
          aria-labelledby="resultados-productos"
          className="px-2 min-[1180px]:columns-2 min-[1180px]:gap-x-6"
        >
          {shown.map((product) => (
            <li key={product.productId} className="break-inside-avoid">
              <ProductRow
                product={product}
                sort={sort}
                metric={metric}
                max={max}
              />
            </li>
          ))}
        </ul>
      )}
      {rows.length > topProducts && (
        <div className="border-t border-border px-4 pt-1 min-[820px]:px-5">
          <TextLink
            className="min-h-11"
            aria-expanded={all}
            onClick={() => onAll(!all)}
          >
            {all
              ? `Ver los ${topProducts} primeros`
              : `Ver todos (${rows.length})`}
          </TextLink>
        </div>
      )}
    </Panel>
  )
}

function ProductRow({
  product,
  sort,
  metric,
  max,
}: {
  product: MonthlyProductRow
  sort: ProductSort
  metric: ProductMetric
  max: number
}) {
  const unsold = sort === 'sin'
  const figure = figureOf(product, sort, metric)
  const byProfit = sort === 'ganancia' && metric === 'pesos'
  const value = unsold
    ? 'Sin ventas'
    : metric === 'cajas'
      ? boxesText(product.boxes)
      : formatCents(figure)
  const margin = percentText(
    marginBps(product.marginCents, product.revenueCents) / 100,
  )
  return (
    <div className="rounded-[10px] px-3 py-2.5 hover:bg-muted/60">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className="text-sm font-[650] text-ink-figure">
            {product.name}
          </span>{' '}
          <span className="text-xs text-ink-muted">{product.boxName}</span>
        </span>
        <span
          className={cn(
            'shrink-0 text-sm font-bold tabular-nums',
            unsold ? 'font-normal text-ink-muted' : 'text-ink-figure',
            figure < 0 && 'text-destructive',
          )}
        >
          {value}
        </span>
      </span>
      {!unsold && (
        <>
          <span
            aria-hidden="true"
            className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-secondary-foreground/80"
              style={{ width: `${barShare(figure, max)}%` }}
            />
          </span>
          <span className="mt-1.5 block text-xs text-ink-muted tabular-nums">
            {byProfit ? 'Venta' : 'Ganancia'}{' '}
            {formatCents(byProfit ? product.revenueCents : product.marginCents)}{' '}
            · Margen {margin}
          </span>
        </>
      )}
    </div>
  )
}

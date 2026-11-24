import { describe, expect, test } from 'bun:test'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MonthlyProducts } from '#/modules/reports/components/monthly/monthly-products'
import {
  barShare,
  compactPesos,
  listProducts,
  niceTicks,
} from '#/modules/reports/components/monthly/monthly-chart-math'
import { MonthlyResultsPage } from '#/modules/reports/components/monthly/monthly-results-page'
import type { MonthlyViewSearch } from '#/modules/reports/components/monthly/monthly-results-page'
import { ReportViewSwitch } from '#/modules/reports/components/report-view-switch'
import type { MonthlyResultsPageLoad } from '#/modules/reports/server/load-monthly-results'
import type {
  MonthlyDay,
  MonthlyResults,
  MonthlyTotals,
} from '#/modules/reports/types/monthly-results'

const days = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-09',
  '2026-11-10',
]
const sold: Record<string, [number, number]> = {
  '2026-11-02': [100_050, 20_000],
  '2026-11-03': [50_000, 10_000],
}
const byDay = days.map((day): MonthlyDay => {
  const [revenueCents, marginCents] = sold[day] ?? [0, 0]
  return {
    day,
    orders: revenueCents ? 1 : 0,
    revenueCents,
    costCents: revenueCents - marginCents,
    marginCents,
    boxes: revenueCents ? 12.5 : 0,
  }
})
const totals = (scale: number): MonthlyTotals => ({
  orders: 2 * scale,
  revenueCents: 150_050 * scale,
  costCents: 120_050 * scale,
  marginCents: 30_000 * scale,
  boxes: 25 * scale,
})
const results: MonthlyResults = {
  month: '2026-11',
  range: { from: '2026-11-01', to: '2026-11-30' },
  through: '2026-11-04',
  days,
  byDay,
  products: [
    {
      productId: 'p1',
      name: 'Crema Ácida Alpura 426 ml',
      sku: 'ALP-426',
      stockUnits: 0,
      position: 1,
      boxName: 'Caja 12',
      boxFactor: 12,
      boxesByDay: { '2026-11-02': 12.5, '2026-11-03': 4 },
      boxes: 16.5,
      revenueCents: 150_050,
      costCents: 120_050,
      marginCents: 30_000,
      marginPerBoxCents: 1818,
    },
    {
      productId: 'p2',
      name: 'Queso Oaxaca 1 kg',
      sku: 'QUE-1',
      stockUnits: 0,
      position: 0,
      boxName: 'Caja 10',
      boxFactor: 10,
      boxesByDay: {},
      boxes: 0,
      revenueCents: 0,
      costCents: 0,
      marginCents: 0,
      marginPerBoxCents: null,
    },
  ],
  totals: totals(1),
  previous: totals(2),
}
const load = (data?: MonthlyResults): MonthlyResultsPageLoad => ({
  allowed: true,
  warehouses: [
    { id: 'w1', name: 'Tejupilco' },
    { id: 'w2', name: 'Sultepec' },
  ],
  suppliers: [{ id: 's1', name: 'LALA', active: true }],
  data,
})

async function inRouter(node: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ['/reportes'] }),
  })
  await router.load()
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

const render = (
  pageLoad: MonthlyResultsPageLoad,
  search: MonthlyViewSearch = {},
  managed = false,
) =>
  inRouter(
    <MonthlyResultsPage
      load={pageLoad}
      search={search}
      onSearch={() => undefined}
      managed={managed}
      today="2026-11-04"
    />,
  )

describe('MonthlyResultsPage', () => {
  test('header: title, scope, month, filters and downloads', async () => {
    const html = await render(load(results))
    expect(html).toContain('Resultados del mes')
    expect(html).toContain('Todo el negocio · 2 almacenes')
    expect(html).toContain('Noviembre 2026')
    expect(html).toContain('Descargar Excel')
    expect(html).toContain('>PDF<')
    expect(html).toContain('Todos los almacenes')
    // The current month cannot be stepped past.
    expect(html).toMatch(/aria-label="Mes siguiente" disabled=""/)
    expect(html).not.toMatch(/aria-label="Mes anterior" disabled=""/)
  })

  test('an earlier month enables the next step', async () => {
    const html = await render(load(results), { mes: '2026-10' })
    expect(html).not.toMatch(/aria-label="Mes siguiente" disabled=""/)
  })

  test('KPIs with the change against the previous month', async () => {
    const html = await render(load(results))
    expect(html).toContain('Venta')
    expect(html).toContain('$1,500.50')
    expect(html).toContain('Cajas vendidas')
    expect(html).toContain('vs. octubre')
    expect(html).toContain('Bajó')
  })

  test('daily chart: title, legend, accessible table and the days of the month', async () => {
    const html = await render(load(results))
    expect(html).toContain('Venta por día')
    expect(html).toContain('Ganancia')
    expect(html).toContain('Semana nueva')
    expect(html).toContain('lun 02')
    expect(html).toContain('lunes, 2 de noviembre de 2026')
    expect(html).toContain('HOY')
    // Days after "through" say so in the table instead of printing $0.00.
    expect((html.match(/Aún no llega/g) ?? []).length).toBe(5)
    expect(html).not.toContain('Venta y ganancia por día</')
    expect(html).not.toContain('Total del mes')
  })

  test('the Round 3 pieces are gone', async () => {
    const html = await render(load(results))
    expect(html).not.toContain('Mostrar productos sin venta')
    expect(html).not.toContain('Cajas por producto')
    expect(html).not.toContain('Gráfica')
  })

  test('product list: chips as pressed buttons, metric switch, unsold hidden', async () => {
    const html = await render(load(results))
    expect(html).toMatch(/aria-pressed="true"[^>]*>Más vendidos</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Menos vendidos</)
    expect(html).toContain('>Mayor ganancia<')
    expect(html).toContain('>Sin venta<')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Pesos</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Cajas</)
    expect(html).toContain('Crema Ácida Alpura 426 ml')
    expect(html).toContain('Caja 12')
    expect(html).toContain('Ganancia $300.00 · Margen 20.0 %')
    expect(html).not.toContain('Queso Oaxaca 1 kg')
  })

  test('the product map is gone and the list has no selection', async () => {
    const html = await render(load(results))
    expect(html).not.toContain('Mapa de productos')
    expect(html).not.toContain('Estrellas')
    expect(html).not.toContain('data-id="')
    expect(html).not.toContain('role="status"')
  })

  test('more than 12 products offer "Ver todos"', () => {
    const many: MonthlyResults = {
      ...results,
      products: Array.from({ length: 20 }, (_, index) => ({
        ...results.products[0],
        productId: `p${index}`,
        name: `Producto ${index}`,
      })),
    }
    const html = renderToStaticMarkup(<MonthlyProducts results={many} />)
    expect(html).toContain('Ver todos (20)')
    expect(html).toContain('>Producto 11<')
    expect(html).not.toContain('>Producto 12<')
  })

  test('a month without sales shows the empty state', async () => {
    const empty: MonthlyResults = {
      ...results,
      products: [],
      totals: totals(0),
    }
    const html = await render(load(empty))
    expect(html).toContain('Sin ventas en noviembre')
    expect(html).not.toContain('Venta por día')
    expect(html).not.toContain('Mapa de productos')
  })

  test('a failed load says why', async () => {
    const html = await render({
      allowed: true,
      warehouses: [],
      suppliers: [],
      error: 'Elige un mes válido.',
    })
    expect(html).toContain('Elige un mes válido.')
  })

  test('a manager picks among their warehouses, never all', async () => {
    const html = await render(load(results), {}, true)
    expect(html).not.toContain('Todos los almacenes')
    expect(html).toContain('>Tejupilco</p>')
  })

  test('someone without access is told so', async () => {
    expect(await render({ allowed: false })).toContain('encargados de almacén')
  })
})

type Props = { children?: ReactNode; onClick?: () => void }
/** Finds the buttons of a plain function component's element tree. */
const buttons = (node: ReactNode): Array<ReactElement<Props>> => {
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<Props>
  const own = element.type === 'button' ? [element] : []
  const children = [element.props.children].flat()
  return [...own, ...children.flatMap(buttons)]
}

describe('ReportViewSwitch', () => {
  test('marks the current view', () => {
    const html = renderToStaticMarkup(
      <ReportViewSwitch value="resultados" onChange={() => undefined} />,
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>Resultados del mes</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Tablero</)
  })

  test('navigating calls onSearch with the `vista` key', () => {
    const patches: Array<unknown> = []
    const tree = ReportViewSwitch({
      value: 'tablero',
      onChange: (patch) => patches.push(patch),
    })
    const [tablero, resultados, repartos] = buttons(tree)
    resultados.props.onClick?.()
    repartos.props.onClick?.()
    tablero.props.onClick?.()
    expect(patches).toEqual([
      { vista: 'resultados' },
      { vista: 'repartos' },
      { vista: undefined },
    ])
  })
})

describe('chart math', () => {
  const soldProduct = (
    name: string,
    revenue: number,
    boxes: number,
    position = 0,
  ) => ({
    ...results.products[0],
    productId: name,
    name,
    position,
    revenueCents: revenue,
    marginCents: Math.round(revenue / 5),
    boxes,
  })
  const unsold = {
    ...results.products[1],
    productId: 'u',
    position: 9,
  }

  test('nice axis ticks start at 0 and end at a round top', () => {
    expect(niceTicks(48_000)).toEqual({
      ticks: [0, 20_000, 40_000, 60_000],
      top: 60_000,
    })
    expect(niceTicks(0).top).toBe(1)
    const { ticks, top } = niceTicks(1234)
    expect(ticks[0]).toBe(0)
    expect(top).toBeGreaterThanOrEqual(1234)
  })

  test('compact pesos', () => {
    expect(compactPesos(80_000)).toBe('$800')
    expect(compactPesos(5_000_000)).toBe('$50 mil')
    expect(compactPesos(1_250_000)).toBe('$12.5 mil')
    expect(compactPesos(120_000_000)).toBe('$1.2 M')
  })

  test('chips order the list; Sin venta is the unsold in catalog order', () => {
    const products = [
      soldProduct('A', 100, 9, 2),
      soldProduct('B', 300, 1, 1),
      soldProduct('C', 200, 5, 0),
      unsold,
    ]
    const names = (
      sort: Parameters<typeof listProducts>[1],
      metric = 'pesos' as const,
    ) => listProducts(products, sort, metric).map((p) => p.productId)
    expect(names('mas')).toEqual(['B', 'C', 'A'])
    expect(names('menos')).toEqual(['A', 'C', 'B'])
    expect(names('mas', 'cajas' as never)).toEqual(['A', 'C', 'B'])
    expect(names('ganancia')).toEqual(['B', 'C', 'A'])
    expect(names('sin')).toEqual(['u'])
  })

  test('bar share is proportional to the longest bar', () => {
    expect(barShare(50, 100)).toBe(50)
    expect(barShare(100, 100)).toBe(100)
    expect(barShare(0, 100)).toBe(0)
    expect(barShare(1, 1000)).toBe(2)
  })
})

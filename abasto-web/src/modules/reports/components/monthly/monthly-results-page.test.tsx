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
import { MonthlyProductsTable } from '#/modules/reports/components/monthly/monthly-products-table'
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

  test('daily table: future days show a dash, week subtotals and month total', async () => {
    const html = await render(load(results))
    expect(html).toContain('Venta y ganancia por día')
    expect(html).toContain('lun 02')
    expect(html).toContain('mar 03')
    expect(html).toContain('Semana 1')
    expect(html).toContain('Total del mes')
    // Thu 5, Fri 6, Sat 7, Mon 9, Tue 10 are after "through"; so is week 2.
    const future = html.match(/>—</g) ?? []
    expect(future.length).toBeGreaterThanOrEqual(5 * 2 + 2)
    expect(html).toMatch(/aria-current="date"[^>]*>.*?mié 04/)
  })

  test('daily table: Cajas column and a dash for past days without sales', async () => {
    const html = await render(load(results))
    expect(html).toMatch(/>Cajas<\/th>/)
    // 04 nov is a past day without orders: no $0.00 anywhere in the panel.
    expect(html).not.toContain('$0.00')
    expect(html).toContain('25')
  })

  test('products: switch, unsold toggle off, unsold hidden from the chart', async () => {
    const html = await render(load(results))
    expect(html).toContain('Gráfica')
    expect(html).toContain('Tabla')
    expect(html).toContain('Mostrar productos sin venta')
    expect(html).not.toContain('Queso Oaxaca 1 kg')
  })

  test('table: catalog order, unsold on request, dashes for days to come, totals row', () => {
    const withUnsold = renderToStaticMarkup(
      <MonthlyProductsTable results={results} unsold />,
    )
    expect(withUnsold.indexOf('Queso Oaxaca 1 kg')).toBeGreaterThan(-1)
    expect(withUnsold.indexOf('Queso Oaxaca 1 kg')).toBeLessThan(
      withUnsold.indexOf('Crema Ácida Alpura 426 ml'),
    )
    expect(withUnsold).toContain('Caja 10')
    expect(withUnsold).toContain('Total cajas')
    expect(withUnsold).toContain('Gan. / caja')
    expect(withUnsold).toContain('Total cajas vendidas')
    expect(withUnsold).toContain('>12.5<')
    expect((withUnsold.match(/>—</g) ?? []).length).toBeGreaterThanOrEqual(4)
    const soldOnly = renderToStaticMarkup(
      <MonthlyProductsTable results={results} unsold={false} />,
    )
    expect(soldOnly).not.toContain('Queso Oaxaca 1 kg')
    expect(soldOnly).toContain('Crema Ácida Alpura 426 ml')
  })

  test('products: ranked row, closed by default', async () => {
    const html = await render(load(results))
    expect(html).toContain('Cajas por producto')
    expect(html).toContain('Crema Ácida Alpura 426 ml')
    expect(html).toContain('ALP-426 · Caja 12')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Cajas de Crema Ácida Alpura 426 ml por día')
  })

  test('an open product lists its exact boxes per day', () => {
    const html = renderToStaticMarkup(
      <MonthlyProducts results={results} initialOpen="p1" />,
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Cajas de Crema Ácida Alpura 426 ml por día')
    expect(html).toContain('>02<')
    expect(html).toContain('>12.5<')
    expect(html).toContain('>4<')
  })

  test('more than 15 products offer "Ver todos"', () => {
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
    expect(html).toContain('Producto 14')
    expect(html).not.toContain('Producto 15<')
  })

  test('a month without sales shows the empty state', async () => {
    const empty: MonthlyResults = {
      ...results,
      products: [],
      totals: totals(0),
    }
    const html = await render(load(empty))
    expect(html).toContain('Sin ventas en noviembre')
    expect(html).not.toContain('Cajas por producto')
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
    const [tablero, resultados] = buttons(tree)
    resultados.props.onClick?.()
    tablero.props.onClick?.()
    expect(patches).toEqual([{ vista: 'resultados' }, { vista: undefined }])
  })
})

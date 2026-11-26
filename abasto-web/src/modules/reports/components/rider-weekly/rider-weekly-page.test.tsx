import { describe, expect, test } from 'bun:test'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { whileHydrated } from '#/modules/reports/components/hydrated-test-helper'
import { RiderWeeklyPage } from '#/modules/reports/components/rider-weekly/rider-weekly-page'
import type { RiderWeeklyPageLoad } from '#/modules/reports/server/load-rider-weekly'
import type { RiderWeeklyReport } from '#/modules/reports/types/rider-weekly'

const report: RiderWeeklyReport = {
  weekStart: '2026-11-16',
  days: [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
  ],
  warehouse: { id: 'w1', name: 'Tejupilco' },
  supplier: { id: 's1', name: 'LALA', active: true },
  riders: [{ id: 'r1', name: 'Luis' }],
  products: [
    {
      productId: 'p1',
      sku: 'L1',
      name: 'Leche entera',
      boxFactor: 12,
      routePayPerBoxCents: 1200,
      pieceCents: 2000,
    },
  ],
  cells: [
    {
      day: '2026-11-16',
      riderId: 'r1',
      productId: 'p1',
      units: 12,
      revenueCents: 24000,
      costCents: 18000,
      scrapUnits: 1,
      routePayCents: 1200,
    },
  ],
}

const load = (data?: RiderWeeklyReport): RiderWeeklyPageLoad => ({
  allowed: true,
  warehouses: [
    { id: 'w1', name: 'Tejupilco' },
    { id: 'w2', name: 'Sultepec' },
  ],
  suppliers: [{ id: 's1', name: 'LALA', active: true }],
  warehouseId: 'w1',
  supplierId: 's1',
  data,
})

async function render(pageLoad: RiderWeeklyPageLoad, node?: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () =>
        node ?? (
          <RiderWeeklyPage
            load={pageLoad}
            search={{ vista: 'repartos' }}
            onSearch={() => undefined}
            today="2026-11-24"
          />
        ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

describe('RiderWeeklyPage', () => {
  test('header: week, scope, filters, day chips and download', async () => {
    const html = await render(load(report))
    expect(html).toContain('Repartos')
    expect(html).toContain('Semana del 16 al 22 de noviembre')
    expect(html).toContain('Tejupilco · Proveedor LALA')
    expect(html).toContain('Descargar Excel')
    expect(html).toContain('Lun 16')
    expect(html).toContain('Dom 22')
    // Past week: the stepper may go forward.
    expect(html).not.toMatch(/aria-label="Semana siguiente" disabled=""/)
  })

  test('one card per rider plus the total, and the product table', async () => {
    const html = await render(load(report))
    expect(html).toContain('RUTA 1 / LUIS')
    expect(html).toContain('Total de la semana')
    expect(html).toContain('Leche entera')
    // venta 240 − costo 180 − pago ruta 12 = 48.
    expect(html).toContain('$48.00')
    expect(html).toContain('1 pzas')
  })

  test('a week without deliveries says so and offers no download', async () => {
    const html = await render(load({ ...report, cells: [] }))
    expect(html).toContain('Sin repartos liquidados en esta semana')
    expect(html).not.toContain('Resumen por ruta')
  })

  test('the current week cannot be stepped past', async () => {
    const html = await whileHydrated(() =>
      render(
        load(report),
        <RiderWeeklyPage
          load={load({ ...report, weekStart: '2026-11-23' })}
          search={{ semana: '2026-11-23' }}
          onSearch={() => undefined}
          today="2026-11-24"
        />,
      ),
    )
    expect(html).toMatch(
      /aria-label="Semana siguiente" type="button" disabled=""/,
    )
    expect(html).not.toMatch(
      /aria-label="Semana anterior" type="button" disabled=""/,
    )
  })

  test('a refused actor sees the access note', async () => {
    const html = await render({ allowed: false })
    expect(html).toContain('Los reportes son para el dueño')
  })
})

import type { ReactNode } from 'react'

import {
  SkeletonCards,
  SkeletonChart,
  SkeletonHeading,
  SkeletonKpis,
  SkeletonPanels,
  SkeletonTable,
  SkeletonTabs,
  SkeletonToolbar,
} from '#/components/route-skeletons/parts'

const sections: Array<[prefix: string, view: () => ReactNode]> = [
  [
    '/mostrador',
    () => (
      <>
        <SkeletonHeading actions={2} />
        <SkeletonKpis count={3} />
        <SkeletonToolbar />
        <SkeletonTable rows={7} columns={6} />
      </>
    ),
  ],
  [
    '/clientes',
    () => (
      <>
        <SkeletonHeading />
        <SkeletonToolbar filters={1} />
        <SkeletonTable columns={5} />
      </>
    ),
  ],
  [
    '/catalogo',
    () => (
      <>
        <SkeletonHeading actions={2} />
        <SkeletonToolbar filters={3} />
        <SkeletonCards />
      </>
    ),
  ],
  [
    '/inventario',
    () => (
      <>
        <SkeletonHeading actions={2} />
        <SkeletonTabs />
        <SkeletonToolbar />
        <SkeletonTable columns={6} />
      </>
    ),
  ],
  [
    '/repartos',
    () => (
      <>
        <SkeletonHeading />
        <SkeletonTabs count={3} />
        <SkeletonTable rows={6} columns={5} />
      </>
    ),
  ],
  [
    '/almacenes',
    () => (
      <>
        <SkeletonHeading />
        <SkeletonCards count={4} />
      </>
    ),
  ],
  [
    '/reportes',
    () => (
      <>
        <SkeletonHeading actions={2} />
        <SkeletonKpis />
        <SkeletonChart />
        <SkeletonTable rows={4} columns={4} />
      </>
    ),
  ],
  [
    '/configuracion',
    () => (
      <>
        <SkeletonHeading />
        <SkeletonPanels count={2} />
      </>
    ),
  ],
  [
    '/tienda',
    () => (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <SkeletonCards count={6} />
      </div>
    ),
  ],
]

const overview = () => (
  <>
    <SkeletonHeading />
    <SkeletonKpis />
    <SkeletonPanels />
  </>
)

const sectionFor = (pathname: string) =>
  pathname === '/'
    ? overview
    : (sections.find(
        ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )?.[1] ?? overview)

/** Page-shaped placeholder for the section `pathname` points to. */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const view = sectionFor(pathname)
  return (
    <div role="status" aria-busy="true" aria-label="Cargando">
      <div data-slot="route-skeleton">{view()}</div>
    </div>
  )
}

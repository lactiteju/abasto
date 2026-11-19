# monthly-results

Client asked (WhatsApp, file `RESULTADOS NOVIEMBRE 2026.xlsx`, sheet "VENTA Y GANANCIA POR DIA") for a monthly report: first table the daily sale and daily profit in pesos; second table the boxes sold per product per day. Design chosen with impeccable (surface round, key bb3aa6d5): **Producto primero**.

## Specs

- S1 Month report data: for a calendar month (`YYYY-MM`), Monday–Saturday plus any Sunday with sales; per day orders, revenue, cost, margin and boxes; per product boxes per day, total boxes, revenue, cost, margin, margin per box; totals and previous-month totals. Same sales definition and cost as `services/sales-report.ts` (picked-up orders + settled rider deliveries). Contract: `abasto-web/src/modules/reports/types/monthly-results.ts`.
- S2 Boxes: a product's box presentation is the one whose name starts with "caja" (case-insensitive), else its largest factor > 1; boxes = base units ÷ box factor (loose pieces give fractions). Without a presentation of factor > 1, boxes = base units and factor 1.
- S3 Scope: owner sees all warehouses or one; manager only the warehouses they manage (reuse `report-scope.ts`); optional supplier filter.
- S4 UI "Resultados del mes" inside `/reportes` (search `vista=resultados`, `mes=YYYY-MM`): month stepper, warehouse/supplier filters, KPI strip (venta, ganancia, margen, cajas vs previous month), products ranked by margin each with one micro-bar per day of boxes, expandable to exact numbers; fixed right panel Fecha · Venta · Ganancia with "—" for days after `through`; phone: KPIs, daily table, products.
- S5 Downloads: Excel (exceljs, lazy loaded) with sheet "Venta y ganancia por día" (weekly subtotals + month total) and sheet "Cajas por producto" (product × day matrix, total cajas, ganancia por caja, ganancia); PDF landscape with both tables.
- S6 Checks: `bun test` green; tsc, eslint, prettier clean; `bun run build` OK; desktop and mobile screenshots; impeccable detect.

## Tasks

- T1 [S1, S2, S3] writer — service, server function and tests. Status: pending.
- T2 [S5] writer — Excel and PDF builders and tests. Status: pending.
- T3 [S4] — UI. Status: pending.
- T4 [S6] — checks, visual review, commits on `dev`. Status: pending.

## Log

- L1 (user): "me gustaria que sacara un excel o pdf con el formato que te di solo que un poco mas bonito, y en la UI un dashboard con graficas"
- L2 (user): chose "Producto primero" on the impeccable decision page; approved reset of impeccable build state, cajas conversion, warehouse filter, hiding Sundays and the exceljs dependency ("si").
- L3 (decision): Sundays hidden unless they had sales, so month totals never lose money.

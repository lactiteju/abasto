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

- T1 [S1, S2, S3] writer — service, server function and tests. Status: done. Commit: 34225e0
- T2 [S5] writer — Excel and PDF builders and tests. Status: done. Commit: 3c3d016
- T3 [S4] writer — UI. Status: done. Commit: this UI commit.
- T4 [S6] writer + inline — checks and visual review. Status: done.

## Log

- L1 (user): "me gustaria que sacara un excel o pdf con el formato que te di solo que un poco mas bonito, y en la UI un dashboard con graficas"
- L2 (user): chose "Producto primero" on the impeccable decision page; approved reset of impeccable build state, cajas conversion, warehouse filter, hiding Sundays and the exceljs dependency ("si").
- L3 (decision): Sundays hidden unless they had sales, so month totals never lose money.
- L4 (evidence): owner and manager captured at 1440 and 390 (`abasto-web/.impeccable/review/`); fixed in one batch: daily total hidden under the panel scroll, expanded day grid clipped, faint dash contrast, uppercase section eyebrow. No page overflow from this view at 390px. Detector: 8 advisory off-ramp font sizes shared with sibling owner components, left as is.
- L5 (fix): the 1st of November 2026 is a Sunday with sales and stood alone as "Semana 1", giving six weeks. Weeks now run Sunday to Saturday like the client's calendar (RED 3 failing sheet tests, then GREEN).
- L6 (evidence): `bun test` 1618 pass, 2 skip, 0 fail; tsc clean; eslint and prettier clean on touched files; `bun run build` OK, exceljs in its own lazy chunk.
- L7 (slice): service, export and UI shipped as three commits; the UI commit is over the ~400-line slice because the view cannot ship half-built. The feature closes here; no more code goes on this slice.
- L8 (open): switching back to Tablero keeps `mes` in the URL; a manager asking for a warehouse that is not theirs sees the generic reports message.

## Round 2 (client format feedback)

- S7 Two separate Excel files instead of one workbook with two sheets: `ventas-diarias-YYYY-MM.xlsx` (Fecha · Venta diaria · Ganancia diaria, weekly subtotals, month total) and `cajas-por-producto-YYYY-MM.xlsx` (product × day matrix, Total cajas, Ganancia por caja, Ganancia; bottom "Total cajas vendidas" and "Total de ganancia"). Brand colours kept.
- S8 Tablero download menu also offers both Excel files for the month of the period on screen (same warehouse and supplier); the old CSV stays.
- T5 [S7, S8] writer — split Excel and wire both downloads. Status: done. Commit: this commit. Evidence: bun test 1621 pass, 2 skip, 0 fail; tsc, eslint, prettier clean; build OK with exceljs lazy. Open menus not browser-clicked.
- L9 (user): showed the old Tablero CSV ("Este es el excel que quedo") next to the client's sheet; chose two separate files, brand colours, matrix with total, per-box margin and margin, and the Excel also from Tablero.

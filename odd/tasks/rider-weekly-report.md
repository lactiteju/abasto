# rider-weekly-report

Client request 24 nov 2026: weekly report of the 3 repartos (mainly LALA) like their Excel `VENTA_X_DIA_GANANCIA SEMANA 1 (16 AL 22 NOV).xlsx`. Branch `dev`.

## Decisions

- D1 (user): warehouse profit is real: venta − costo real del lote − pago a ruta. Route profit = pago a ruta por caja (new product field) × cajas vendidas (prorated by pieces: sold pieces × pay / boxFactor).
- D2 (user): week is Monday–Sunday.
- D3 (user): Excel keeps the client's format: one sheet per day + «SEMANAL».
- D4 (user): settle gets a «Merma» input; damaged pieces do not return to the warehouse and show in the report.
- D5 (agent): the day of a reparto is its settlement day (`rider_assignments.closed_at`, business TZ), as the existing sales report does.
- D6 (agent): pago a ruta is frozen on each assignment line when the reparto is created (like prices), so later edits do not rewrite history. Lines created before the migration get the product's current value via backfill in the migration.

## Specs

- S1 Pago a ruta (catalog, owner only): products get `route_pay_cents` (integer, per box of the product's box factor, default 0, not null). Product create/edit form (owner) shows «Pago a ruta por caja» money input; CSV import untouched unless trivial. `rider_assignment_lines.route_pay_cents` (not null default 0) is filled from the product at assignment creation and on «Recargar»/«Editar carga» when lines are added; migration backfills existing lines from products.
- S2 Merma al liquidar (riders): settle dialog gets per line a «Merma (pzas)» digits-only input, clamped so regresó + merma ≤ assigned. Merma pieces are neither sold nor returned: they are taken from the line's allocations (newest-first or same order as leftovers — consistent and documented) and recorded as `loss` movements (category `dañado`, reason `Reparto <rider name>`) on the allocation's lot; the lot is NOT replenished for them. Allocations get `scrap_quantity` (nullable until settled; sold = quantity − leftover − scrap). Expected cash excludes merma. Line/assignment detail shows merma when > 0. Server validates caps.
- S3 Report service (reports): `riderWeeklyReport(actor, {warehouseId, supplierId?, weekStart})` owner only (managers: their warehouse — same scope rules as monthly). For each settled assignment in the week (D5), per day × rider × product: pieces sold, venta cents, costo cents (lot cost of sold units), merma pieces, pago ruta cents (sold pieces × line.route_pay_cents / boxFactor, rounded per line), ganancia depósito = venta − costo − pago ruta. Riders = those with activity in the week (plus active riders of the warehouse, ordered by name). Products = supplier scope with sales or merma in the week, catalog order. Week totals.
- S4 View «Repartos» in Reportes: third option in `ReportViewSwitch` (`vista=repartos`), search `semana` (YYYY-MM-DD Monday), `almacen` (default warehouse), `proveedor` (default: supplier whose name contains «lala», else all). Header with ‹ semana › («Semana del 16 al 22 de noviembre»), filters, day chips (Semana · Lun … Dom). Cards per rider + total: piezas, venta, ganancia depósito, ganancia ruta, merma. Table per product: SKU, Producto, then per rider Pzas · Venta · Gan. depósito · Gan. ruta, then Total pzas · Gan. depósito · Gan. ruta · Gan. total; totals row. Same visual language as «Resultados del mes».
- S5 Excel «Repartos» download: file `repartos-semana-YYYY-MM-DD.xlsx`, one sheet per day named «16 NOV» … plus «SEMANAL», title row «RUTAS <PROVEEDOR> <ALMACÉN>», header like the client's: SKU, PZ X CAJA, PRODUCTO, PAGO RUTA X CAJA, PRECIO X PZ, then per rider block «RUTA n / NOMBRE» with PZ VENDIDAS, VENTA, GANANCIA DEPÓSITO, GANANCIA RUTA, then TOTAL PZ, PZ MERMA, GANANCIA TOTAL DEPÓSITO, GANANCIA TOTAL RUTA, GANANCIA TOTAL; totals row; money format. Reuse ExcelJS lazy-load pattern of monthly-results-xlsx.
- S6 Checks: RED first for pure libs and services, `bun test` green (run alone), tsc clean, eslint/prettier clean on touched files.

## Tasks

- T1 [S1,S2] writer — schema, migration 0041, catalog field, freeze, settle merma. Status: done. Merma ledger: loss movement fromReserved (load only reserves). Full bun test 1710 pass.
- T2 [S3,S4,S5] writer — report service, view, Excel. Status: done (on-screen Merma column added; cost rounded per cell).
- T3 [S6] verify. Status: done: bun test 1745 pass 2 skip 0 fail, tsc clean. Not checked in browser.

## Log

- L1 (user): client Excel analysed: per day sheets + SEMANAL, per route PZ VENDIDAS / VENTA PZ / GANANCIA DEPOSITO / GANANCIA RUTA, DATOS sheet with salida/devueltas/merma/venta real/precio/costo FIFO.
- L2 (user): answers D1–D4.

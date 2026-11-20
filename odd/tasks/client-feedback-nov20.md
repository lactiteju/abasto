# client-feedback-nov20

Client WhatsApp corrections, 20 nov 2026. Branch `dev`.

## Specs

- S1 Liquidar reparto (`riders/forms/settle-dialog.tsx`): the inputs «Regresó (cajas)» and «Regresó (unidades)» accept only digits and cannot exceed what was assigned. Cajas are capped at the whole boxes assigned. Unidades are capped at the assigned quantity minus the boxes typed × boxFactor. A value over the cap is clamped to the cap while typing, so the field never shows an impossible number. Existing preview validation stays as a backstop.
- S2 Traspasar cajas (`transfers/forms/owner-transfer-dialog.tsx`, owner only): replace the product `<select>` with the large product-picker layout used by «Nuevo reparto» / «Nuevo pedido» (`components/large-dialog.tsx`, `components/data-table.tsx`, `riders/components/load-products-table.tsx`). It needs a search box by name or SKU and a table row per product with whole boxes available in the origin, showing image, name, SKU, «N cajas disponibles» and a «Cajas» input capped to the available boxes. Several products can go in one transfer, applied in a single DB transaction (extend the server fn to take lines; keep server-side validation of availability and owner role). Origin/Destino selects stay.
- S3 Excel «Cajas por producto» (`reports/lib/monthly-results-sheet.ts`, `monthly-results-xlsx.ts`, and the PDF boxes table if it shares the model): add a «SKU» column before PRODUCTO. Rows include only products that currently have stock in the report scope (warehouse/supplier filter), or that sold something in the month (decision L2). Totals stay correct.
- S4 Checks: focused tests (RED first where behavior changes), `bun test` green, tsc clean, prettier/eslint clean on touched files.

## Tasks

- T1 [S1] writer — settle dialog caps. Status: done (uncommitted).
- T2 [S2] writer — transfer picker dialog + multi-line server fn. Status: done (uncommitted).
- T3 [S3] writer — SKU column + stock-or-sold filter. Status: done (uncommitted).
- T4 [S4] verify — full suite and typecheck. Status: done (uncommitted).

## Log

- L1 (user): client screenshots: settle inputs accept huge numbers; transfer dialog should look like sale/reparto pickers with image and search by name/SKU; boxes Excel needs SKU and only products «con existencia».
- L2 (user): «con existencia» = stock today in scope OR sales in the month.
- L3 (evidence): bun test 1670 pass, 2 skip, 0 fail; tsc clean; eslint clean on riders/transfers/reports. Transfer dialog and PDF not checked visually.

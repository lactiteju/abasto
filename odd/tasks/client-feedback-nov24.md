# client-feedback-nov24

Client WhatsApp corrections, 24 nov 2026. Branch `dev`.

## Specs

- S1 Merma (owner only, `inventory`): the Inventario header gets a «Merma» button next to «Imprimir inventario» / «Nuevo pedido», visible only when the overview says `canAdjustStock`. It opens a large picker dialog (same layout as owner «Traspasar cajas»: `components/large-dialog.tsx`, `components/data-table.tsx`, search by name or SKU, image, name, SKU) for the selected warehouse. Each row shows «N piezas disponibles» (on-hand base units, not held/reserved) and a «Piezas» input, digits only, clamped to available. Reason chips «Dañado» (default) / «Caducado», optional note. Several products in one submit, applied in one DB transaction. Server: new service that, per product, takes pieces from that product's lots in the warehouse FEFO (earliest expiry first, then oldest) and records `loss` movements via the existing lot movement path with the category; refuses if pieces exceed available; authorizes `stock.adjust`. Success toast, refresh inventory. Existing per-lot «Quitar existencias» stays.
- S2 Almacén predeterminado (owner, `warehouses`): `warehouses.is_default boolean not null default false` with a partial unique index (only one true). Migration 0040 also sets `is_default = true` where `lower(name) = 'tejupilco'`. `listWarehouses` orders default first, then name, so every `.at(0)` fallback (Inventario, Catálogo, Ventas, Repartos, Tienda) opens the default. /almacenes card shows a «Predeterminado» badge on the default and a «Marcar como predeterminado» button on the others (owner, `warehouses.manage`), setting it in one transaction (clear others, set this).
- S3 Checks: focused tests (RED first), `bun test` green, tsc clean, prettier/eslint clean on touched files.

## Tasks

- T1 [S1] writer — Merma dialog + multi-product FEFO loss service. Status: done (uncommitted; full-suite run pending T3).
- T2 [S2] writer — default warehouse column, migration, ordering, card action. Status: done (storefront ordering fixed inline).
- T3 [S3] verify. Status: done.

## Log

- L1 (user): screenshots: «Merma» = product in warehouse already damaged, remove from inventory, in pieces; owner defaults to Tejupilco, Arcelia optional; user suggests the default button lives on the warehouse page.
- L2 (evidence): tsc clean; full bun test 1688 pass, 2 skip, 2 fail (overview tests missing isDefault in expectations) → fixed, 11/11 pass on rerun. UI not checked in browser.

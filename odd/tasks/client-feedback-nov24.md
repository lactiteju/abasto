# client-feedback-nov24

Client WhatsApp corrections, 24 nov 2026. Branch `dev`.

## Specs

- S1 Merma (owner only, `inventory`): the Inventario header gets a «Merma» button next to «Imprimir inventario» / «Nuevo pedido», visible only when the overview says `canAdjustStock`. It opens a large picker dialog (same layout as owner «Traspasar cajas»: `components/large-dialog.tsx`, `components/data-table.tsx`, search by name or SKU, image, name, SKU) for the selected warehouse. Each row shows «N piezas disponibles» (on-hand base units, not held/reserved) and a «Piezas» input, digits only, clamped to available. Reason chips «Dañado» (default) / «Caducado», optional note. Several products in one submit, applied in one DB transaction. Server: new service that, per product, takes pieces from that product's lots in the warehouse FEFO (earliest expiry first, then oldest) and records `loss` movements via the existing lot movement path with the category; refuses if pieces exceed available; authorizes `stock.adjust`. Success toast, refresh inventory. Existing per-lot «Quitar existencias» stays.
- S2 Almacén predeterminado (owner, `warehouses`): `warehouses.is_default boolean not null default false` with a partial unique index (only one true). Migration 0040 also sets `is_default = true` where `lower(name) = 'tejupilco'`. `listWarehouses` orders default first, then name, so every `.at(0)` fallback (Inventario, Catálogo, Ventas, Repartos, Tienda) opens the default. /almacenes card shows a «Predeterminado» badge on the default and a «Marcar como predeterminado» button on the others (owner, `warehouses.manage`), setting it in one transaction (clear others, set this).
- S3 Checks: focused tests (RED first), `bun test` green, tsc clean, prettier/eslint clean on touched files.

- S4 Merma per product (user, after S1): remove the header «Merma» button from Inventario. Each product row (desktop table `products-tab.tsx`) and card (mobile `product-cards.tsx`) replaces its «Lotes» / «Mínimo» buttons with one «⋯» menu (`src/components/row-actions-menu.tsx`, accessible name «Acciones de <producto>») with items «Lotes», «Mínimo» (same conditions as today) and, when `canAdjustStock` and the product has free pieces (onHand − reserved > 0), «Registrar merma» in warning tone, separated. It opens a compact dialog (normal Dialog, not LargeDialog) for that one product: image/name/SKU, «N piezas disponibles», «Piezas» digits-only clamped, chips «Dañado» (default) / «Caducado», optional note, «Registrar merma». Reuses the existing `registerProductLoss` action/server fn with one line (no service change). Delete `MermaDialog` / `MermaTable` / `merma-draft` and their tests if they become unused.
- S5 «Mermas» tab (user): new tab in Inventario after «Movimientos» (same tab style, icon e.g. a damaged-box/trash icon) listing the warehouse's `loss` movements newest first: fecha y hora, producto (image, name, SKU), piezas, motivo (Dañado / Caducado / Reparto <rider> / other reason text), lote (expiry), registrado por, and cost of the lost pieces when available from the lot. Filters: search product name/SKU, motivo, and period (this week / this month / all, or reuse whatever period control the movements tab has). Totals at top: piezas and costo of the filtered rows. Visible to whoever sees Movimientos. Reuse the movements data source (filter type 'loss') if it carries what is needed; otherwise extend the server read minimally. Empty state «Sin mermas registradas».

## Tasks

- T1 [S1] writer — Merma dialog + multi-product FEFO loss service. Status: done (uncommitted; full-suite run pending T3).
- T2 [S2] writer — default warehouse column, migration, ordering, card action. Status: done (storefront ordering fixed inline).
- T3 [S3] verify. Status: done.
- T4 [S4,S5] writer — product row actions menu, single-product merma dialog, Mermas tab. Status: done (inventory 430 pass; free pieces = onHand − reserved − inRoute; tab loads last 200 losses; not seen in browser).

## Log

- L1 (user): screenshots: «Merma» = product in warehouse already damaged, remove from inventory, in pieces; owner defaults to Tejupilco, Arcelia optional; user suggests the default button lives on the warehouse page.
- L2 (evidence): tsc clean; full bun test 1688 pass, 2 skip, 2 fail (overview tests missing isDefault in expectations) → fixed, 11/11 pass on rerun. UI not checked in browser.

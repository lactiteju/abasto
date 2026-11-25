# ventas-layout

User request 24 nov 2026: improve the Ventas (`/mostrador`) layout with impeccable; start with an actions button that reduces on-screen buttons. Branch `dev`. Mode: Operate (refinement, keep the staff console identity).

## Specs

- S1 Row actions menu: in `counter/components/order-list.tsx` (desktop table and mobile cards) replace the per-row buttons «Nota PDF», «Editar venta», «Ver pedido» with one «⋯» menu per row (accessible name «Acciones de PED-…»). Items: «Ver pedido» (always), «Nota PDF» (Recogido), and for owner on Recogido «Editar venta», separated and in warning tone (destructive). «Editar venta» still opens its confirmation AlertDialog with the same copy and behavior; «Nota PDF» still generates the same PDF (with its loading/error feedback). The whole row (desktop) / card (mobile) also opens the order on click/Enter (keyboard-focusable, not triggered when interacting with the menu). Move `riders/components/row-actions-menu.tsx` to a shared place (`src/components/row-actions-menu.tsx`) since two modules now use it; update riders and catalog imports if they use it. Refactor `ReopenSaleButton` / `RemissionNoteButton` so their logic can be triggered from a menu item (e.g. controlled dialog + hook), keeping the order detail dialog usage working.
- S2 Checks: component tests for the menu items per status/role and row click, `bun test` for counter/riders/catalog, tsc, eslint/prettier on touched files.

## Proposals pending user choice (not in scope until chosen)

- P1 Move «Duración de la reserva» (rare owner setting) out of the main flow into Configuración or a small settings popover.
- P2 Caja panel: keep «Entrada» and «Retiro», put «Cerrar caja» as the clear primary of the panel and «Historial» as a link; tighten the KPI strip.
- P3 Toolbar: warehouse select and status chips on one row plus a search by cliente or PED.
- P4 Table: add «Fecha» column (hora de venta / vence), wider Cliente, total emphasised.

## Tasks

- T1 [S1,S2] writer. Status: done (450 focused tests pass; not seen in browser; no DOM test env).

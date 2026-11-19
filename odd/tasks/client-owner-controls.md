# Client corrections: owner-only catalog controls, warehouse rename, owner transfers

Objective: apply the 2026-11-19 client feedback batch in `abasto-web`. Branch `dev`. Test runner: `bun test` in `abasto-web` against the isolated test database. Workers load the `code-organization` skill first (AGENTS.md).

## Specs

- S1: Rename warehouse — "Ya estoy en el usuario de dueños pero aún no logro ver donde pueda cambiar el nombre". The owner can rename a warehouse from `/almacenes` (each card offers "Cambiar nombre"/edit). Same rules as create: trimmed, non-empty, max 80 chars, case-insensitive unique ("Ya existe un almacén con ese nombre."). Server guard `warehouses.manage` (owner only). Success toast, dialog closes, list refreshes.
- S2: Prices owner-only — "Estoy en el usuario de Laura (Encargado)… me está permitiendo cambiar precios… solo quiero que lo haga el de dueños. Quítalo de aquí". User decision: remove "Precios" and "Editar" for non-owners in catalog cards and table row actions (prices stay visible as text on the card). Server: saving prices (`setPricesFn`), piece cost (`savePieceCostFn`) and product edits are refused for non-owners.
- S3: "Proveedores", "Importar CSV", "Nuevo producto" owner-only — "También estas dos funciones solo que lo haga el de dueños". Buttons hidden for non-owners; server-side create/update supplier, create product, CSV import, presentations, archive/restore refuse non-owners. Concretely: managers no longer receive `catalog.manage` / `catalog.cost`; price writes require owner.
- S4: Owner transfer between warehouses — "En el usuario de dueño… un botón que nos permita hacer traspaso entre agencia… de Tejupilco a Arcelia y de Arcelia a Tejupilco… en cajas completas". User decisions: immediate (stock leaves origin and enters destination at once, no "en ruta"/reception step); button "Traspasar" in the `/almacenes` header next to "Nuevo almacén". Dialog: origin, destination (≠ origin), product, number of whole boxes (integer ≥ 1, default presentation factor). Lots taken FEFO from available (non-reserved, non-expired) units in origin; destination lots keep expiry, cost and sale price, linked via `sourceLotId`; ledger records `transfer_out`/`transfer_in` in one transaction; refused with a Spanish message when there are not enough boxes. Owner only on the server. Recorded so it appears in the existing transfers/movements history.
- S5: Checks — `bun test` green; tsc, eslint, prettier clean on changed files.

## Tasks

- T0 [S1-S4] explore — map surfaces. Status: done (L2).
- T1 [S2, S3, S5] worker — catalog/pricing owner-only (policy, services, UI, tests). Risk: item 2 (permissions). Status: done, uncommitted (manager refusals RED→GREEN; 2 inventory tests outside surface handed back → T3).
- T2 [S1, S4, S5] worker — warehouse rename + immediate owner transfer (service, server fn, dialogs on `/almacenes`, tests). Risk: item 1 (stock writes). Status: done, uncommitted (81 focused tests pass; no migration; stored as transfer status `Recibido`; dialogs not browser-checked; private DB `abasto_t2_test` left on port 55451).

- T3 [S2, S5] parent inline — reception tests receive as owner + manager-refused test; order dialog and `/inventario` price editing owner-only; reception "Actualizar costo en catálogo" checkbox owner-only and off for managers (it defaulted on, which would make manager receptions fail). Risk: item 2. Status: done. Checks: bun test 1579 pass / 2 skip / 0 fail; tsc, eslint, prettier clean on changed files.
- T4 [S1-S5] verify — independent verification of transfer atomicity/FEFO and permission changes. Status: done (mwo2odo9: no blockers; 822 + 539 focused tests pass; race probe 3 pass; non-blocking: per-lot cost rounding drift same as two-step receive, `::int` cast in box listing, no concurrency test shipped).

## Log

- L1 (user): four client screenshots (rename warehouse; prices owner-only; Proveedores/Importar CSV/Nuevo producto owner-only; owner transfer in whole boxes). Decisions: transfer "Inmediato (recomendado)"; Precios "Quitarlo (recomendado)"; location "Almacenes (recomendado)".
- L2 (evidence, explore): `access/lib/policy.ts:66-67` grants `catalog.manage`/`catalog.cost` to any warehouse manager; `pricing/services/prices.ts:73` uses `warehouse.manage`; buttons gated by `canManage` in `routes/catalogo.tsx:29-35` and `catalog/components/catalog-page.tsx`; row actions `catalog-row-actions.tsx:78,83`; no warehouse update exists (`warehouses/services/warehouses.ts`, create at 16-41, dialog `create-warehouse-dialog.tsx`); transfers module `transfers/services/transfer-dispatch.ts:58`, `transfer-receive.ts:34` (two-step); ledger `inventory/services/stock-ledger.ts` (`appendMovement`, `lockLot`, `byFefo`); `presentations.factor`; `lots.sourceLotId`.
- L3 (evidence, verify mwo2odo9): no blockers; immediate transfers refuse receive/cancel ("Este traslado ya no está en tránsito."); no manager UI entry left that hits forbidden. Leftovers: private DBs `abasto_t2_test`, `abasto_t4_test` and `/tmp/t4probe/`.

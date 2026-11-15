# Client feedback — Nov 14

Five adjustments the client sent as annotated photos (WhatsApp), with the user's notes and decisions. Commits on `dev` (AGENTS.md).
UI copy is Spanish (es-MX); code and identifiers in English. The database is development only: migrations that rewrite data are allowed (nov13 L3).

## Specs

- **S1 — Cards first in the catalog.** Client: "Aquí en el catálogo, hazlo más grande como lo teníamos antes .. se más chido ." User: "aqui solo haz default el de tarjetas antes que el de tabla". The catalog opens in «Tarjetas» when the user has no stored choice; the toggle lists «Tarjetas» before «Tabla». A stored choice is still honored.
- **S2 — Maximize «Nuevo pedido».** Client: "Al dar nuevo pedido que me permita hacer la ventana grande .." The counter new-order dialog has a maximize/restore button next to the close X; maximized it fills the whole viewport (no max width).
- **S3 — Edit a reserved order.** Client: "Al darle en el pedido Reservado . Que me permita aumentar más cajas y aumentar otro producto mediante un buscador .." In the counter order dialog of a «Reservado» (unexpired) order, the user can raise the boxes (and pieces) of an existing line and add another product found with a search box. Added units are reserved from lots like a new order (FIFO, same availability rules); a raised line keeps its frozen unit price and a new product line is priced like a new order; the order total updates. Without enough available stock the change is rejected and nothing changes. Orders not «Reservado» cannot be edited.
- **S4 — «Grupo Lala» → «LALA» and supplier edit.** Client: "En todos lados donde diga el texto Grupo Lala.. solo dejar LALA". User: "Esto es cosa de tener una opcion para editar el proveedor, como nombres y datos que pide al registrarlo". The supplier is named «LALA» in the seed and in the stored data; suppliers can be edited (name and the registration fields) from the catalog's suppliers dialog, and the edit option is easy to find.
- **S5 — Per-supplier folio.** Client: "En nuevo pedido al proveedor .. no te salió el consecutivo ... E001, E002, E003.. etc". User: "sugiereme una secuencia o numeracion para darselo, como inicial del proveedor y numero de pedido por ejemplo Alpura es A00001 o LALA seria L00001 y asi consecuitivamente." Decision (L2): each supplier has an editable «Clave de folio» (default: its initial; if taken, another letter or two letters); each supplier has its own consecutive of 5 digits: A00001, A00002… L00001… The new-order dialog shows the next folio before saving. Existing E-folios are renumbered to the new format per supplier in creation order; lots already created keep their codes.

## Tasks

- [x] T1 — S1, S2 — inline — catalog default cards + toggle order; maximize/restore button in CounterDialog full. Commit 7601b70.
- [x] T2 — S3 — worker — reserved-order edit service, server fn, UI with search. Commits cd0f836 (service), 4a61b9f (UI), 038d3b7 (cancel/pickup-after-edit test); independent verify S3 pass.
- [x] T3 — S4, S5 — worker — supplier folio key (schema, migration 0038, edit form), per-supplier consecutive, preview in dialog, LALA rename. Commits 457699e, 8d18177, eac8ac4; independent verify S4 pass, S5 pass.
- [x] T4 — all — three independent verifies (T1 S1-S2 static pass; T2 S3 pass incl. forced races; T3 S4-S5 pass, migration 0038 exercised in rolled-back transactions); full suite 1354 pass / 2 skip / 0 fail, tsc clean, eslint src 0 errors (4 warnings). On-screen check not done; migration 0038 not yet applied to the Supabase dev DB.

## Log

- L1 — User: "Vamos a cubrir las peticiones del cliente [Image#2] aqui solo haz default el de tarjetas antes que el de tabla, [Image#3] [Image#4] [Image#5] Esto es cosa de tener una opcion para editar el proveedor, como nombres y datos que pide al registrarlo, [Image#6], creo que este ya lo habiamos trabajado, sugiereme una secuencia o numeracion para darselo, como inicial del proveedor y numero de pedido por ejemplo Alpura es A00001 o LALA seria L00001 y asi consecuitivamente." (image captions quoted in S1–S5).
- L2 — Decisions: folio → "Clave por proveedor + consecutivo propio (Recomendado)"; old folios → "Renumerarlos al nuevo formato (Recomendado)".
- L3 — Findings: supplier edit already exists (`catalog/forms/suppliers-dialog.tsx`, `updateSupplier`); the nov13 full-viewport dialog is in `main`, the client's photo is from the Vercel URL (possibly an older deploy). Reservation default is 24 h (configurable), the photo shows 47 h.
- L4 — T1 verify: S1, S2 pass (static); test run blocked by T3's unfinished migration 0038 (NOT NULL without backfill). Slice boundary: past ~400 lines after 4a61b9f; the rest of the feature (T3) goes as its own commits.
- L5 — T2 verify: S3 pass (133 tests). Spec wording aligned to the implemented rule (raised lines keep the frozen price). Gap closed in 038d3b7: cancel/pickup after an edit. Known minor gaps left: no inactive-customer check on edit; raising a line whose presentation lost its warehouse price is refused; overdue-but-unmarked orders show «Agregar productos» (server rejects).
- L6 — T2 race verify (item 4): 17 pass; edit vs create/edit/cancel/pickup forced races keep lots.reserved = Reservado allocations, no over-reserve. Reports failures (18) seen during T3 commit were a shared test-DB collision. T3 committed 457699e, 8d18177; T3 verify running.
- L7 — T3 verify: S4, S5 pass. Fixed in eac8ac4: legacy references made the folio jump or overflow int — only key + exactly 5 digits count now; manager-dashboard tests updated to A00001/C00001. Known minor: SQL accent list narrower than the app's (non-Spanish accents); purchases.reference not unique across suppliers if a freed key is reused.

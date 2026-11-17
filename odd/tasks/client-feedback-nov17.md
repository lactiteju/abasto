# Client feedback — Nov 17

Four adjustments the client sent as annotated photos (WhatsApp), with the user's decisions. Commits on `dev` (AGENTS.md).
UI copy is Spanish (es-MX); code and identifiers in English. Workers load the `code-organization` skill first.

## Specs

- **S1 — Open the cash drawer at $0 without asking.** Client: "al cerrar caja ya me permita abrir de una vez una cuenta nueva .. porque me pide cantidad de dinero de cuánto la abro y eso NO se hace aquí". Decision: the «Abrir caja» button opens the drawer directly with opening $0 (no dialog, no amount). Close flow (blind count, result) unchanged. Server unchanged (0 already allowed).
- **S2 — Delete a customer (owner).** Client: "Estoy en el usuario de dueños .. pero no me permite eliminar clientes". Decision: «Eliminar cliente» = deactivate (soft delete, `active=false`), history kept. Available to whoever has `customers.manage` (owner), from the customer detail dialog (and/or row), with a confirmation that explains it disappears from lists and new sales but history is kept. Inactive customers can be restored by the owner (existing edit form / filter).
- **S3 — Riders catalog is owner-only.** Client: "En el usuario de Tejupilco permite agregar Repartos .. yo creo esto solo lo tiene que hacer el usuario de dueño". Decision: the manager («Encargado») no longer sees the riders table («Nuevo repartidor», rename, activate/deactivate); server rejects create/rename/setActive for non-owners. Managers keep creating/recharging/settling assignments (repartos) with existing riders.
- **S4 — Nota de remisión PDF.** Client: "Al entregar y cobrar un pedido ... ponme exportar en PDF lo que fue, cantidad y la cuenta .. Sería como una nota de remisión .. una se la entregan a los jefes y otra al vendedor". Decision: «Nota PDF» button for «Recogido» orders in the Mostrador orders table row and inside «Ver pedido». PDF looks like a paper nota de remisión: business name, «NOTA DE REMISIÓN», folio (PED-…), fecha, cliente, almacén; table CANT. | ARTÍCULO | PRECIO | IMPORTE; TOTAL; «PAGADO» mark; signature line «Recibí de conformidad». Reuse the lazy jspdf approach of reports.

## Tasks

- [x] T1 — S1 — worker — cash panel opens at $0 directly.
- [x] T2 — S2 — worker — customer deactivate («Eliminar cliente»).
- [x] T3 — S3 — worker — riders catalog owner-only (UI + server).
- [x] T4 — S4 — worker — order nota de remisión PDF.
- [x] T5 — verify, full suite, commits on dev.

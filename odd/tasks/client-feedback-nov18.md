# Client feedback — Nov 18

Five adjustments the client sent as annotated photos (WhatsApp), with the user's decisions. Commits on `dev` (AGENTS.md).
UI copy is Spanish (es-MX); code and identifiers in English. Workers load the `code-organization` skill first.

## Specs

- **S1 — Nota for «Liquidar reparto».** Client: "usando liquida reparto también requerimos que imprima la nota amigo. Igualita que en el de Ventas". Decision: a settled («Liquidada») assignment can print a nota de remisión with the same renderer as Mostrador (`counter/lib/remission-note-pdf.ts`, original + copia on one letter sheet). Content: business, title «NOTA DE REMISIÓN», folio of the assignment, fecha (settled time), repartidor (label «Repartidor», not «Cliente»), almacén; table CANT. | ARTÍCULO | PRECIO | IMPORTE with the **sold** quantity (assigned − leftover) priced with the frozen lot prices; TOTAL = expected amount; also show «Entregado» and the difference (faltante/sobrante) when non-zero; signature line. Triggers: «Imprimir nota» item in the repartos row «⋯» menu for Liquidada rows, and right after a successful settle (offer/print from the success path).
- **S2 — Dialogs do not close on outside click.** Client: "le doy click fuera de ella y desaparece la pantalla ... Mejor que sea necesario darle cerrar o salir". Decision: no dialog/sheet closes on a click outside, app-wide (single choke point in `components/ui/dialog.tsx` / `sheet.tsx`). Escape still closes (keyboard, intentional).
- **S3 — Business name editable by the owner.** Client: the sidebar card «Distribuidora del Sur / Tejupilco, Estado de México» → «Distribuidora de Lácteos», editable from the owner profile. Decision: persist business name + location in a new single-row settings table (migration, default name «Distribuidora de Lácteos», location «Tejupilco, Estado de México»); owner edits both in «Configuración»; every consumer of `workspace.business` (sidebar, remission notes, settlement notes, reports PDFs, store config, inventory PDF) reads the persisted value.
- **S4 — Inventory products table scroll.** Client: "ponme dos barras ... una que deslice los productos y ... llegar rápido a la otra barra que recorre hacia la derecha". Decision: the desktop products table gets a fixed viewport-relative height with its own vertical scroll and sticky header, so the horizontal scrollbar is always visible at the bottom of the panel.
- **S5 — Inventory PDF for physical count.** Client: "exportamelo en un PDF (solo el inventario con existencia) para poderlo imprimir y ... hacer el conteo en bodega ... separado como lo tienes de Alpura y Lala". Decision: «Exportar PDF» in the inventory products tab, for the selected warehouse; only products with on-hand > 0; one section per supplier; columns Producto, SKU, Existencia (cajas + pz), Caducidad más próxima, Conteo (blank box for handwriting). Header with business, almacén, fecha.

## Delivery

One work-unit commit per spec on `dev` (each reviewable alone, tests with code). `dev` deploys to staging; the dev→main merge stays a separate, user-authorized step. Slice boundary: this feature's commits start after e3cdc6f.

## Tasks

- [x] T1 — S1 — worker — settlement nota de remisión (1a8529c).
- [x] T2 — S2 — worker — dialogs ignore outside click (02ca9ab, lint fix after; mobile nav drawer opts out via `dismissOnOutside`).
- [x] T3 — S4+S5 — worker — inventory table scroll + count PDF (4a4ab3e).
- [x] T4 — S3 — worker — persisted, owner-editable business name (migration 0039_business_settings; not applied to the real DB yet).
- [x] T5 — full suite 1537 pass / 2 skip / 0 fail, tsc + eslint clean; commits on dev.

## Round 2 (client retest on dev, Nov 18 afternoon)

- **S6 — «Entregado» prefilled with the expected amount.** Client: "el monto por default de lo esperado ... en automático ... (obviamente editable) porque prácticamente todos los días se tiene que cerrar al 100%". Decision: the settle dialog's delivered-cash field starts with the expected amount (from the live preview) and stays editable; while the user hasn't typed it, it follows the expected amount as leftovers change.
- **S7 — «Nota PDF» fails in Mostrador ("Ocurrió un error. Intenta de nuevo.") and the rider nota did not print.** Regression on dev. Find the root cause (shared renderer `counter/lib/remission-note-pdf.ts`, `use-remission-note.ts`, `useBusiness`, server fetch), fix it, and cover it with a test that exercises the real jsPDF path. Both notas must print original + copia on one letter sheet ("dos notitas en una misma hoja").
- **S8 — Dialogs still close on an outside click.** Client retested: "Este detalle aún está" (the «Productos de …» dialog in Repartos). Find which dialogs bypass `DialogContent`'s `keepOpenOnOutside` (or why it doesn't take effect) and fix app-wide.
- **S9 — «Hacer conteo» becomes «Imprimir inventario».** Client: "Cambia esto .. y solo manda a imprimir el inventario .. se ocupa todos los días impreso. Ya nosotros contamos sobre ese inventario". Decision: the inventory header button «Hacer conteo» is replaced by «Imprimir inventario», which downloads the count PDF (S5) for the selected warehouse and current supplier filter; drop the duplicate toolbar «Exportar PDF». The Conteos tab stays.

- [ ] T6 — S7+S8 — worker — diagnose and fix the nota PDF regression and the outside-click dialogs.
- [ ] T7 — S6+S9 — worker — prefilled delivered amount; «Imprimir inventario» button.
- [ ] T8 — full suite, commits on dev, push.

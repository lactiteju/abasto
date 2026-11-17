# Client feedback — Nov 16

Four adjustments the client sent as annotated photos (WhatsApp), with the user's notes and decisions. Commits on `dev` (AGENTS.md).
UI copy is Spanish (es-MX); code and identifiers in English. Workers load the `code-organization` skill first.

## Specs

- **S1 — Edit quantities of a reserved order.** Client: "Mira al darle en un pedido Reservado ... Que nos permita editar la cantidad de producto y poner un buscador para por si quiere otro producto de inmediato agregarlo por Fas". Decision (L2): in the counter order dialog of a «Reservado» (unexpired) order, each line's quantity (cajas + piezas) can be raised, lowered or the line removed, and another product can be added with the existing search (nov14 S3). Raising/adding keeps nov14 rules (FIFO reserve, availability check, raised line keeps frozen unit price, new line priced like a new order). Lowering releases the reserved units back to their lots (lots.reserved stays equal to the Reservado allocations); removing a line releases all of it. The last remaining line cannot be removed (use «Cancelar pedido»). The order total updates. Any invalid change (not Reservado, expired, short stock, empty order) is rejected and nothing changes.
- **S2 — Supplier filter in «Nuevo reparto».** Client: "Aquí se requiere que solo dejes producto de LALA .. ya que Alpura no entra a reparto por el momento". User: "que deje filtrar por proveedor por si acaso efectivamente luego si se puede repartir alpura". Decision (L2): the new-assignment dialog has a «Proveedor» filter over the product picker; it starts on the supplier named LALA (case-insensitive) when it exists, otherwise «Todos»; the user can switch to another supplier or «Todos». Filtering only narrows the picker; the server keeps accepting any product.
- **S3 — Numeric fields reject letters.** Client: "De preferencia que no deje capturar letras en los campos que van números .." and "Letras .." (Liquidar reparto). Decision (L2): app-wide, every quantity field accepts only digits and every money/decimal field accepts only digits and one decimal point (max 2 decimals); typed or pasted letters are dropped as the user types. Submit-time validation stays.

## Tasks

- [x] T1 — S1 — worker — reserved-order line edit (lower/remove) service + server fn + UI. Commits c44adf9, a97a319; independent verify S1 pass incl. 8 forced-race tests (order-edit-concurrency.test.ts).
- [x] T2 — S2 — worker — supplier on assignable products + filter in assign dialog. Commit 9bd117c (riders 88 tests pass).
- [x] T3 — S3 — worker — shared numeric sanitize helper (`src/lib/numeric-input.ts`) applied in Input / FieldInput / CompactInput by inputMode. Commit 8aaf918. Supplier-cost fields allow 4 decimals (stored in ten-thousandths).
- [x] T4 — all — full suite 1391 pass / 2 skip / 0 fail, tsc clean, eslint 0 errors (4 old warnings). On-screen check not done.

## Log

- L1 — User: "Vamos a hacer correcciones que nos pidio el cliente, [Image#1], [Image#2] Aqui que deje filtrar por proveedor por si acaso efectivamente luego si se puede repartir alpura, [Image#3], [Image#4]" (captions quoted in S1–S3).
- L2 — Findings: nov14 S3 (add-only edit, «Agregar productos») is in `dev` but not in `main`, so the Vercel deploy the client uses lacks it. Decisions: reserved order → "Subir, bajar y quitar líneas"; reparto → "Filtro Proveedor, LALA por defecto"; numeric → "En toda la app".
- L3 — Slice boundary: `dev` is ~5.9k lines past `origin/main` (19 commits) before this feature; each task here goes as its own commit(s) so review stays per work unit; the dev→main merge waits for the user's authorization.
- L4 — T1 verify minor (non-blocking): shortage alert shows on both box and piece lines of one product; «En el pedido: N» shows the original quantity; units freed from an expired lot count as available in the UI but the server refuses; «Quitar» stays enabled on the last line (save refused with toast). T3: pasted `1e3` can still enter `type="number"` fields; no component/browser test of caret behaviour. Parallel test runs collide on the shared test DB — run suites one at a time.

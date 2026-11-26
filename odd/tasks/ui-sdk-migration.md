# Migrate the web primitive layer from radix-ui to ui-sdk

Decisions (user, 26 nov):
- **Keep the API of `abasto-web/src/components/ui/*`**: rewrite wrapper internals
  on `@ui-sdk/react`; call sites change only where a Radix-only prop leaks.
- **Keep the current look**: Tailwind + tokens in `src/styles.css`. No `web.css`.
- **Consistency**: raw controls that duplicate a primitive go through the
  primitive; hard-coded palette/hex colors become tokens; unify sizes, states, focus.
- Commits per unit on `dev`, never `main`.

Agent decisions:
- Keep `sonner` (not Radix). Keep `dialog-maximize.tsx`. Sheet → ui-sdk Drawer.
- Select becomes popup-positioned (ui-sdk has no item-aligned mode).
- Replace radix `Slot`/`asChild` with ui-sdk `render`; where no ui-sdk part
  exists (sidebar), a small local slot helper in `src/lib/` is acceptable.
- Wrappers keep `useHydrated` guards (button, tabs) and Spanish validity
  handlers (input, textarea, select).
- Map Radix `data-state=open|active|checked` selectors to ui-sdk state
  attributes (`data-open`, `data-selected`, `data-starting-style`,
  `data-ending-style`, …). Read attribute names from the component docs.

Rules for every unit: load skills `code-organization` and `ui-sdk`
(`.agents/skills/ui-sdk/SKILL.md`); read
`abasto-web/node_modules/@ui-sdk/react/docs/llms.txt` and only the component
pages needed. Import from entries (`@ui-sdk/react/dialog`). Never read `dist/*.js`.
Keep existing tests green; update tests that assert Radix internals so they
guard the same behavior on ui-sdk. Run from `abasto-web/`: `bunx tsc --noEmit`,
`bun run lint`, `bun test <touched tests>`.

## T1 — Basic primitives

`ui/button.tsx` (asChild → ui-sdk Button `render`, keep `buttonVariants`,
variants, hydration guard), `ui/label.tsx`, `ui/input.tsx` (keep native
`onChange` numeric helpers), `ui/textarea.tsx`, `ui/separator.tsx`; add
`@layer ui-sdk;` at the very top of `src/styles.css`. Fix call sites that pass
Radix-only props to these.

## T2 — Overlays

`ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/sheet.tsx` (on Drawer, same exported
API incl. `side`, `showCloseButton`, `dismissOnOutside`), `components/large-dialog.tsx`,
raw Radix dialog uses in `modules/customers/components/customer-modal.tsx`,
`modules/catalog/components/catalog-modal.tsx`, `modules/store/components/orders-page.tsx`;
rewrite `ui/dialog-outside.test.tsx` to guard outside-press-keeps-open on ui-sdk.
No portal in ui-sdk: verify stacking (top layer) and backdrop/animations.

## T3 — Select, Tabs, Tooltip, Menus, Sidebar

`ui/select.tsx`, `ui/tabs.tsx` (keep exported names `TabsTrigger`/`TabsContent`
mapping to `TabsTab`/`TabsPanel`; keep hydration guard), `ui/tooltip.tsx`
(`delay={0}` default; Provider becomes passthrough), `components/row-actions-menu.tsx`
and `modules/catalog/components/catalog-row-actions.tsx` on ui-sdk Menu,
`ui/sidebar.tsx` Slot/Tooltip usages, `modules/inventory/components/inventory-page.tsx`
`data-state=active` selectors, `routes/__root.tsx` if needed, call sites of select
(`modules/inventory/components/picker.tsx`, `modules/access/components/assign-warehouse-dialog.tsx`).

## T4 — Consistency cleanup (after T1–T3)

Duplicated form-control wrappers (`counter/components/form-controls.tsx`,
`inventory/components/form-controls.tsx`, `reports/components/report-fields.tsx`,
`product-import/components/import-fields.tsx`, `catalog/forms/form-field.tsx`,
`customers/forms/form-field.tsx`, `components/search-box.tsx`) → shared primitives;
hard-coded palette/hex colors → tokens.

## T5 — Remove radix-ui and verify

Drop `radix-ui` from `abasto-web/package.json` when unused; build, full test,
browser check of dialogs, sheet, select, tabs, tooltip, menus.

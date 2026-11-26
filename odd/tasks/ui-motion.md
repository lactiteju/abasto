# Animate the whole web UI

Decisions (user, 26 nov):
- **Expressive and fast**: motion is noticeable and has character (scale,
  slide, overshoot springs, staggers), but never slows work: short durations,
  interruptible, nothing blocks input.
- Scope "de todo a todo": primitives, page entrances, route changes, tabs,
  lists/tables, KPIs, feedback (toasts, save states, errors), hovers/press.
- Commits per unit on `dev`, never `main`.

Agent decisions:
- No new animation dependency. CSS transitions/keyframes, `@starting-style`,
  CSS `linear()` springs, ui-sdk `data-starting-style`/`data-ending-style`,
  and the View Transitions API (`document.startViewTransition` /
  TanStack Router's view-transition support if present) for route changes.
  `tw-animate-css` is already installed and may be used.
- Only `transform`, `opacity`, `filter`, `clip-path` are animated; never
  height/width/top/left on hot paths.
- Keyboard-driven, high-frequency actions (mostrador typing, scanning,
  quantity steppers via keyboard) stay instant or near-instant.
- `prefers-reduced-motion: reduce` → crossfades only (or nothing), no
  movement, no stagger.
- Store module (`modules/store`, `store.css`) keeps its own theme but uses the
  same motion tokens.

Rules for every unit: load skills `code-organization`, `ui-sdk`, and the
animation skills in `.agents/skills/` (`emil-design-eng` first, then the one
for the step: `find-animation-opportunities`, `animate`, `choreograph`,
`animation-performance`, `review-animations`). Read
`abasto-web/node_modules/@ui-sdk/react/docs/styling-and-animation.md`
("Animate Opening and Closing") before touching ui-sdk popups.

## T1 — Opportunity map (read-only)

Run `find-animation-opportunities` over `abasto-web/src`; output a ranked list
per area (primitives, layout/route, each module) with the motion intent.

## T1 result (26 nov) — tokens and rules

Today: durations 100/150/160/200/400ms with default `ease`, `transition-all`
on Button/Tabs/sidebar, sidebar animates width/left/right, `tw-animate-css`
unused, no route transitions, only store.css handles reduced motion.

Tokens (`@theme` in styles.css):
`--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out:
cubic-bezier(0.77,0,0.175,1)`, `--ease-spring: linear(...)` (generate real
samples, overshoot ≤ 4%), press 120ms / hover 150ms / popup 150 in · 110 out /
dialog 220 in · 160 out / tab 180 / page 240 / toast 320 in · 200 out,
stagger 30ms capped at 8 items, distances 6/8/12px, scale press 0.97,
popup 0.96. Nothing over 320ms. Reduced motion: opacity/color only ≤150ms.

Rules: no transitions on `data-hydrating` flips; page/list entrances run on
client navigation, not replayed on SSR first paint; origin-aware popups
(`origin-(--transform-origin)`); hover lifts behind
`@media (hover:hover) and (pointer:fine)`; rejected: mostrador keyboard line
editing, order-row keyboard focus, store stepper typing, row hover motion.

## T2 — Motion tokens + primitives

Tokens in `abasto-web/src/styles.css` (durations, easings, springs, stagger,
distances) as Tailwind theme values/utilities, plus the reduced-motion
override. Apply to `components/ui/*`, `components/native-select.tsx`,
`components/row-actions-menu.tsx`, `components/large-dialog.tsx`, sonner
toaster config, buttons/inputs hover-press-focus.

## T3 — Shell, routes and shared page patterns

Route transitions, sidebar/topbar, page heading entrance, tabs panel change,
list/table row stagger, skeleton → content, empty states, KPI/number changes.

## T4 — Module passes

Apply the shared patterns to each module's specific moments (counter, inventory,
catalog, reports charts, riders, customers, store).

## T5 — Review

`review-animations` + `animation-performance` over the diff; browser check
including reduced motion.

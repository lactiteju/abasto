# Fast navigation: no frozen page, cached views, no waterfalls, server timing

Problem (user, 26 nov): in production, switching views takes very long and the
current page stays frozen until the next one's data arrives.

Findings (local measure, docker DB): navigations take 40–550 ms locally, so
the framework is not the bottleneck; production latency (server ↔ DB / client
↔ server) multiplies per query. Every route has a blocking `loader`; there is
no `pendingComponent`; `defaultPreloadStaleTime: 0`; router `staleTime`
default 0 (each visit refetches); TanStack Query is installed but unused;
`/inventario` loader runs two sequential rounds (overview → transfers,
orders, pendings); `/reportes` has 4 awaits. Mutations refresh with
`router.invalidate()` (14 call sites).

Decisions (user): implement all four units. Commits per unit on `dev`.

## N1 — Pending UI and router cache

- Router: `defaultPendingMs` ~150, `defaultPendingMinMs` ~300,
  `defaultPendingComponent` that renders a route-shaped skeleton (by
  pathname: heading + toolbar + table/cards/KPIs) inside the app shell, so
  sidebar/topbar stay and the new section is shown immediately.
- Sidebar marks the target item active immediately on click (pending
  location), and a thin top progress bar (transform scaleX) runs while
  navigating.
- View transition must not freeze the old page while loaders run: skip the
  view transition when showing the pending skeleton or keep it only for the
  final swap; verify the page stays interactive.
- Router cache: `defaultStaleTime` (e.g. 30 s) and a sane
  `defaultPreloadStaleTime`, so revisits and hover-preloads are instant and
  stale data refreshes in background; mutations keep calling
  `router.invalidate()` (check none is missing after a mutation).
- Respect reduced motion; skeleton uses `ui/skeleton`.

## N2 — Remove loader waterfalls and stream secondary data

- `/inventario`: resolve the selected warehouse on the server in one round
  (or fetch secondary data in parallel), and defer secondary panels
  (transfers, supplier orders/pendings) with streamed promises + `<Await>`/
  Suspense so the main table renders first.
- `/reportes` and any other route with sequential awaits: parallelize; defer
  non-critical blocks.
- Keep SSR and existing tests green.

## N3 — Server timing in production

- A global server-function middleware (TanStack Start `createMiddleware`,
  registered in the start instance) that measures each server fn duration and
  DB time, logs one structured line (`fn`, `ms`, `dbMs`, `queries`) and adds a
  `Server-Timing` header; DB timing via the drizzle/pg logger or a wrapped
  pool. Off-by-default verbose logs; always-on `Server-Timing`.
- Document in this file how to read it in production (browser DevTools
  Timing tab, server logs).

## N3 — How to read it in production

Implementation: `abasto-web/src/lib/server-timing/` (global function
middleware registered in `src/start.ts`), pg query timing in
`src/db/timing.ts`. Response bodies are never modified.

- **Header (always on).** Every `_serverFn` response carries
  `Server-Timing: fn;dur=<ms>, db;dur=<ms>;desc="<N> queries"`. In browser
  DevTools → Network → select the `_serverFn/...` request → **Timing** tab →
  "Server Timing". Compare `fn` with the request's "Waiting for server
  response": the difference is network/proxy latency, `fn − db` is app code.
  The SSR document response carries one entry per loader server-fn call
  (comma separated).
- **`db` is the sum of query durations**, so with parallel queries it can
  exceed `fn`. `queries` counts every statement, including `BEGIN`/`COMMIT`.
  Many queries × high DB latency is the signature of a slow view in
  production (cost grows per round trip).
- **Logs (opt-in).** One JSON line per call on stdout, e.g.
  `{"event":"server-fn","fn":"overviewFn","ms":38.2,"dbMs":96.3,"queries":28}`.
  Printed only when `ms >= SLOW_FN_MS` (default `300`) or for every call with
  `TIMING_LOG=1`. Filter with `grep '"event":"server-fn"'` or your log
  platform's JSON field `fn`/`ms`.

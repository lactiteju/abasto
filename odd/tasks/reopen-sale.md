# reopen-sale

Client request 24 nov 2026 (Ventas / mostrador, owner only): «Editar venta» on a sale already done (Recogido), with confirmation; the sale goes back so inventory returns until it is liquidated again. Branch `dev`.

## Decisions

- D1 (user): the money of the reopened sale leaves today's open cash drawer as an outflow movement «Venta reabierta PED-…»; requires an open drawer in the order's warehouse. Closed cash cuts are never modified. Re-delivering charges again normally.
- D2 (user): any order in status Recogido can be reopened, no time limit.
- D3 (agent): reopening returns the order to «Reservado»: delivered units go back to the same lots as reserved stock (on_hand += qty, reserved += qty, ledger movements that reverse the sale, consistent with how deliver records them), so the existing reserved-order edit and «Entregar»/liquidar flow apply unchanged. Reservation expiry must not auto-release a reopened order immediately (reset the reservation window from now, or exempt it — choose consistently with existing expiry logic and document).
- D4 (agent): reports count the sale only once: after reopen it is no longer Recogido, so it disappears from sales until re-delivered on the new day. Record who/when reopened (audit) on the order.

## Specs

- S1 Service `reopenSale(actor, orderId)` owner only (new policy action or existing owner-only permission), in one transaction: order must be Recogido; requires open cash session in the order warehouse (clear Spanish error «Abre la caja para reabrir la venta»); posts cash outflow = amount that entered cash for that order (sum of its payment movements; handle partial/credit payments the way the order model stores them — only reverse what actually entered the drawer, and reopen any customer credit/balance consistently); restores stock as reserved; status → Reservado; audit fields. Idempotency/conflict: second call fails cleanly.
- S2 UI: in Ventas orders list (screenshot: row actions «Nota PDF», «Ver pedido»), owner sees «Editar venta» on Recogido rows (also in order detail if natural). Click → confirm AlertDialog «¿Editar esta venta? Se regresa a Reservado, el inventario vuelve a apartarse y $X sale de la caja.» → on success open the existing edit flow for the reserved order and toast.
- S3 Checks: RED first, service DB tests (stock back as reserved per lot, cash outflow, manager forbidden, needs open drawer, not Recogido refused, reopen → edit → deliver again gives correct stock/cash/reports), `bun test` alone green, tsc, eslint/prettier.

## Tasks

- T1 [S1,S2,S3] writer. Status: done: outflow as withdrawal «Venta reabierta PED-…», stock back as reserved per lot, expiresAt reset, cash sale_cycle index; bun test 1753 pass. Not checked in browser.

## Log

- L1 (user): screenshot + D1, D2 answers.

# Consistency pass baseline (2026-05-20)

Project: `odkbpeelvcdmlimdflbr`

## `orders.order_status` CHECK (Postgres)

Allowed: `reserved`, `awaiting_pickup`, `paid`, `collected`, `no_show`, `cancelled`, `refunded`, `disputed`, `resolved`.

**Not in DB:** `ready_for_pickup` — app alias maps `awaiting_pickup` → `ready_for_pickup` in `orderStatus.ts`.

## Status distribution (snapshot)

| order_status | payment_status | count |
|--------------|----------------|-------|
| reserved | paid | 1 |
| reserved | pending | 1 |
| paid | paid | 1 |
| awaiting_pickup | pending | 1 |
| collected | paid | 1 |
| cancelled | refunded | 1 |
| disputed | pending | 1 |
| resolved | paid | 1 |

## Known QA anomaly

`reserved` + `payment_status = paid` (e.g. A00031) — handover must accept via `payment_status` until status syncs to `paid`.

## RPCs (post `merchant_handover_v1`)

- `mark_order_no_show(uuid)` — grace 30m after `pickup_end`
- `merchant_collect_order(p_order_id, p_code)` — sets `collected`, `collected_at`, clears `customer_arrived_at`
- `customer_signal_arrival(p_order_id)` — sets `customer_arrived_at`
- `admin_collect_order(p_order_id)` — admin mark-collected parity

## Late pickups QA

To test the late tab: set a bag's `pickup_end` in the past (SQL or edit in Supabase). Demo seed windows are often ~9h long, so the tab stays empty until then — use fixture **`A00032`** (late) or **`A00033`** (review-pending) instead of demo-only bags.

## Finance definitions (perfection pass)

See [`docs/runbooks/finance-metrics-definitions.md`](../runbooks/finance-metrics-definitions.md).

## Inventory (perfection pass)

- `trg_decrement_bag_on_reserve` — decrements `rescue_bags.quantity_remaining` on order insert (`reserved`); raises `P0001` when oversold.
- `trg_merchant_promotion_used_count` — bumps `merchant_promotions.used_count` when `promo_codes` redeemed on paid orders (title matches code).

## Web remediation (2026-05-20)

Next.js app (`fresh-as-ever`) now mirrors mobile for handover RPCs, customer arrival, merchant tab filters, and admin platform orders. Verify with `npm run lint` and `npm run build` in that repo.

## QA fixture snapshot (applied 2026-05-20 via Supabase MCP)

| Code | Purpose | Notes |
|------|---------|-------|
| `B32UYL` | Customer arrival CTA | `payment_status=paid`, pickup window open now |
| `A00031` | Live monitor hero | `customer_arrived_at` set, ends in ~90m |
| `A00032` | Late pickups tab | `pickup_end` ~25m ago, `paid` |
| `A00033` | Review-pending | pickup starts in ~6h |

## Migrations on remote

- `merchant_handover_v1` (20260520215402) — column + merchant/customer RPCs
- `admin_collect_order_v1` — admin collect RPC (added when missing from first deploy)
- `handover_rpc_revoke_anon_v1` — revoke `anon` execute on handover RPCs

## Columns used by pass

- `orders.collected_at` — merchant must set on collect (admin already does)
- `orders.customer_arrived_at` — added in `merchant_handover_v1`

## Demo pickup windows

`refresh_demo_rescue_bag_pickup_windows` sets ~9h windows — live monitor 2h queue often empty; late tab empty until `pickup_end < now`.

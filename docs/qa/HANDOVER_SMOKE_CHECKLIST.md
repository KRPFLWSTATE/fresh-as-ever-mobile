# Handover smoke checklist (customer code → merchant verify → DB)

Use on staging before release. Evidence: Supabase row + mobile and web roles.

## Preconditions

- Two test accounts: **customer** (completed profile with phone if testing dialer) and **merchant staff** for the listing outlet.
- Optional SQL: see `docs/supabase/profiles_merchant_read_phone_via_order_v1.sql` if merchant UI never receives `customer_phone`.
- QA fixtures on project `odkbpeelvcdmlimdflbr`: `B32UYL` (arrival), any paid collectible for handover.

## Flow (mobile + web)

1. **Customer** reserves a bag (checkout). Confirm `orders.reservation_code` is six alphanumeric chars.
2. Order should reach **`reserved`** + **`payment_status=paid`** or **`paid`** / **`awaiting_pickup`** before merchant handover.
3. **Customer (optional):** Order detail → **I'm at the outlet** → `customer_signal_arrival` sets `customer_arrived_at`.
4. **Merchant** opens Orders → verification tab or order detail → enters 6-character code → **Authorize handover**.
5. Handover must call **`merchant_collect_order`** RPC (not direct `orders.update`).
6. **Supabase:** `order_status` = **`collected`**, `collected_at` set, `customer_arrived_at` cleared per RPC.
7. **Customer** Orders / Order detail: shows collected path.

## Web-specific

- [`fresh-as-ever/src/hooks/useMerchantOrders.js`](../../fresh-as-ever/src/hooks/useMerchantOrders.js) — `collectOrder`, `authorizeHandoverByCode`
- [`fresh-as-ever/src/app/(merchant)/merchant/orders/[id]/page.js`](../../fresh-as-ever/src/app/(merchant)/merchant/orders/[id]/page.js) — no Mark Collected direct update
- [`fresh-as-ever/src/app/(customer)/orders/[id]/page.js`](../../fresh-as-ever/src/app/(customer)/orders/[id]/page.js) — arrival CTA

## Admin

- **Mark collected** uses **`admin_collect_order`** only (mobile `adminCollectOrder.ts`, web `adminCollectOrder.js`).

## Regression ideas

- Wrong code → “No order found” / outlet mismatch / `code_mismatch`.
- Unpaid or outside window → `order_not_ready` message.
- `anon` role cannot execute collect RPCs (revoked by `handover_rpc_revoke_anon_v1`).

# Group reservations

Up to **5 bags** from the **same outlet** in one checkout, one **shared reservation code**, stored on `reservation_groups`.

## Rules

- Same `outlet_id` for all bags in the cart.
- Pickup windows must overlap (intersection of all bag windows).
- **Card only** when `bag_count > 1` (`group_reservation_requires_card`).
- Single-bag groups may still use cash (subject to first-pickup history).

## Schema

- `public.reservation_groups` — payment + code + pickup window on the group.
- `public.orders.group_id` — child line items (`quantity = 1` each); `reservation_code` null on children.

## RPC

`create_group_reservation(p_bag_ids uuid[], p_payment_method text, p_promo_code text)` → `group_id`, `reservation_code`, `total`.

`merchant_collect_group(p_group_id uuid, p_code text)` — marks all child orders collected.

## PayHere

- Hash/webhook `order_id` = `reservation_groups.id` for group checkouts.
- Webhook fans out `paid` to all child `orders` and sends one SMS.

## Merchant handover

`useMerchantOrders.authorizeHandoverByCode` resolves `reservation_groups` first, then legacy single `orders.reservation_code`.

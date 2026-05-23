# Late pickups — merchant design spec

## Purpose

Give merchants an honest, actionable view of orders past `pickup_end` without blocking legitimate late handovers.

## Severity buckets

| Chip | Rule |
|------|------|
| All | Every active order with `pickup_end < now` |
| Critical | 30+ minutes past `pickup_end` |
| Late | 15–29 minutes past |
| Just late | 1–14 minutes past |

Sort: critical first, then by minutes late descending.

## Actions on late cards

- **Call customer** — `tel:` when `profiles.phone` exists
- **Verify pickup** — 6-character code → `merchant_collect_order` RPC
- **Scan QR** — `MerchantScanHandover`
- **Report no-show** — disabled until 30m grace (`isNoShowGraceElapsed`); calls `mark_order_no_show`

## Copy rules

- Never label no-show as "Cancel & waste"
- Disabled no-show shows `No-show in 30m`

## QA

Demo orders with 9h pickup windows will not appear until `pickup_end` is in the past; refresh demo windows or seed a late order for tab testing.

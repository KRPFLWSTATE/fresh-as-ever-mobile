# Frozen golden paths (perfection pass)

Do not change these flows without explicit regression evidence (`HANDOVER_SMOKE_CHECKLIST.md` + `npm run ci`).

## Customer

1. Discover → bag detail → checkout → pay (or cash) → order detail
2. Order detail: 6-character `reservation_code` + QR (mobile); web QR parity
3. "I'm at the outlet" → `customer_signal_arrival` RPC

## Merchant

1. Orders tabs: verification, live monitor, late, review
2. 6-character handover authorize → `merchant_collect_order` RPC (no direct `orders.update` for collect)

## Admin

1. Platform orders search → `admin_collect_order` RPC
2. Export report CSV from live metrics (mobile); web export parity

## RPC signatures (frozen)

- `merchant_collect_order`
- `customer_signal_arrival`
- `admin_collect_order`

Schema changes to inventory (`decrement_bag_quantity`) must not alter these RPC contracts.

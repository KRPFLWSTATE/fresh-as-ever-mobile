# Handover & weekly payouts

## Handover (source of truth)

- Customer shows **6-character `reservation_code`**; QR encodes the same string.
- Merchant collects via `merchant_collect_order` RPC only — never direct `orders.update` for collect.
- Admin uses `admin_collect_order` RPC.

## Payouts

- Settlements rows drive merchant **Pending** vs **Paid out** labels.
- Weekly rollup uses `settlements.period_end` and `net_payout`.
- Export CSV on admin dashboard uses live counts — verify against SQL before investor meetings.

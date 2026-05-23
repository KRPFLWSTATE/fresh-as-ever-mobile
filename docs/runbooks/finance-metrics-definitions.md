# Finance & metrics definitions

## Merchant finance

| Label | Source | Meaning |
|-------|--------|---------|
| Gross sales (all time) | Sum of `orders.total` where `payment_status = paid` OR `order_status = collected` | Customer money for completed rescues |
| Pending payout | Sum of `settlements.net_payout` where `status` in (`pending`, `processing`) | Earned but not yet settled to merchant |
| Paid out | Sum of `settlements.net_payout` where `status` in (`paid`, `completed`) | Already settled periods |
| Commission | `settlements.commission_amount` or platform rate × gross | Platform fee retained |

Withdrawable balance is **not** shown until `payout_requests` is modelled — contact support copy is used instead.

## Merchant analytics

| Metric | Formula |
|--------|---------|
| Revenue (window) | Sum `orders.total` for collected/completed in window |
| Customer reach | `count(distinct customer_id)` in window |
| Waste prevented | Sum of estimated kg per bag (`retail_value_estimate / 800`, min 0.5 kg) × quantity |
| CO₂ estimate | `waste_kg × 2.5` (documented on screen) |
| Popular times | Hour-of-day histogram of order `created_at` |
| Top bags | Group by `bag_id` on collected orders |

## Admin dashboard

| KPI | Source |
|-----|--------|
| Orders (all-time) | `count(orders)` |
| Orders today | `orders.created_at >= start of day` |
| Revenue 7d | Sum `orders.total` for collected/completed in 7-day buckets |
| Open complaints | `complaints` not in resolved/dismissed/closed |

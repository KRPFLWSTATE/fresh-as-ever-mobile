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

## Outlet trust (customer-facing)

| Field | Source | Meaning |
|-------|--------|---------|
| `trust_score` | Denormalized on `outlets`, recomputed by `recompute_outlet_trust` | 0–5 composite score |
| Window | Last 90 days of terminal orders | `collected`, `no_show`, merchant/admin `cancelled` |
| Minimum data | `trust_orders_window >= 5` | Below this, UI shows **New outlet** (`trust_score` null) |
| Formula | 60% star average + 20% collection rate + 10% (1 − complaint rate) + 10% (1 − no-show rate) | Each rate scaled to 0–5 before weighting |

## Surplus recovered (merchant-facing)

| Label | Formula |
|-------|---------|
| Surplus recovered (calendar month) | Sum `rescue_bags.retail_value_estimate × orders.quantity` for `collected`/`completed` orders in the current calendar month |
| Trend | Month-over-month % vs previous calendar month |

Uses bag snapshot retail value at time of analytics query — not `orders.total` (which is rescue price paid).

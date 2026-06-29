# WS8 — Branch-out consistency experiments

**Run:** 2026-06-29 (final closeout)

## Fixed

| Area | Issue | Fix |
|------|-------|-----|
| Group sheet a11y | Nested `Pressable` modal collapsed all children (incl. `merchant.orders.confirmGroupCollect`) into one iOS accessibility node — E2E could preview but not tap Confirm | `MerchantOrdersScreen`: backdrop/sheet containers use `accessible={false}` + `importantForAccessibility="no-hide-descendants"`; sheet body is a `View` with `onStartShouldSetResponder` |
| No-show grace constant | Duplicate `NO_SHOW_GRACE_MS` in `orderStatus.ts` and `pickupWindow.ts` | `orderStatus.ts` now imports from `pickupWindow.ts` (single source) |

## Logged (no code change — by design or low impact)

| Hypothesis | Finding | Action |
|------------|---------|--------|
| Surplus recovered vs today revenue | **Different metrics.** Home `today_revenue` sums `order.total` for orders with `collected_at` today. Analytics `surplusRecovered` sums `bag.retail_value_estimate × qty` (or shelf line retail) on collected orders over the analytics window. A bag sold at rescue price can show lower revenue than surplus recovered. | Documented; labels already distinguish "Collected today" vs surplus card |
| Timezone / `utcShelfDate` | Shelf inventory scoping uses UTC calendar date (`utcShelfDate()` → `YYYY-MM-DD` UTC). Pickup bucket predicates use `Date.now()` + ISO pickup windows (UTC instants). Near UTC midnight, a Colombo merchant could see shelf_date roll before local midnight. | Log only; seeder uses consistent UTC instants; no user bug reported |
| No-show vs late severity thresholds | **Aligned by design.** `lateSeverityFromMinutes`: critical ≥ 30m past `pickup_end`. `isNoShowGraceElapsed`: no-show unlocks at `pickup_end + 30m`. LATCRT scenario is critical-late but no-show button stays disabled until the same 30m grace. | No change |
| Web `/merchant/orders?view=` parity | Mobile Kumbuk E2E PASS for `LATCRT` (Late) and `FUTURE` (Upcoming). Web uses mirrored `merchantOrderFilters.js` with same predicates (`isLatePickup`, review-pending complement). SQL confirms outlet scope filters correctly. | Web UI E2E not run; filter parity confirmed in code + SQL |

## SQL spot-check (Kumbuk scope)

```sql
-- LATCRT → late-pickups (Kumbuk outlet 000…013), paid, past pickup_end
-- FUTURE → review-pending (Kumbuk), reserved+pending, future pickup_start
```

Both verified via Supabase MCP during E2E closeout.

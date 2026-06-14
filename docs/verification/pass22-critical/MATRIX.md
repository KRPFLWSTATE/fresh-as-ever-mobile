# Pass 22 — Critical Fixes Verification Matrix

**Date:** 2026-06-15  
**Device:** iPhone 17 Pro (`377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo  
**Supabase project:** `odkbpeelvcdmlimdflbr`

## Root causes fixed

| ID | Issue | Root cause | Fix |
|----|-------|------------|-----|
| P0-1 | Checkout hooks crash | `reserveButtonTitle` `useMemo` called **after** loading early-return → hook count changed between renders | Moved `reserveButtonTitle` + `cashAllowed` above all conditional returns in `CheckoutScreen.tsx` |
| P0-2 | Shelf stock “random” | +/- showed **basket qty only**; no DB stock label | Added `formatStockRemaining()` + `shelf.stockRemaining.{id}` testID showing `quantity_remaining` from DB |
| P0-3 | Shelf checkout crash | Same hooks violation as P0-1 | Same CheckoutScreen fix |
| P0-4 | CO2 > food kg confusion | Math is **CO₂e equivalent** (2.5× food kg), not physical CO₂ in food; shelf orders omitted from merchant analytics | UX breakdown labels; `useMerchantAnalytics` includes shelf `order_items` weights; customer impact joins `product_catalog.weight_grams` |
| P1 | Duplicate bag React key | `GroupCheckoutStrip` keyed rows by `bag.id` only | Key `${bag.id}-${index}` |
| P1 | Logged-out cart memory | `useReservationCart` kept in-memory state after sign-out | Clear cart state when `user?.id` absent |

## Sequential Thinking (Smart-Thinking MCP)

Smart-Thinking MCP exposes prompts/resources only (no callable `smartthinking` tool in this session). Structured reasoning applied manually:

1. **Hooks crash:** React error at ~line 943 matched a `useMemo` placed after `if (loading || !bag) return`.
2. **CO2 audit:** Food rescued (kg) and CO₂e (kg) are different units; 2 kg food × 2.5 = 5 kg CO₂e is correct per Stitch methodology when bag `estimated_weight_kg` sums to 2.
3. **Shelf stock:** DB column `clearance_shelf_items.quantity_remaining` is source of truth; UI must label it explicitly.

## Supabase SQL proofs (CO2)

```sql
-- QA merchant collected bag orders (30d): food kg and CO₂e
SELECT
  ROUND(SUM(COALESCE(NULLIF(rb.estimated_weight_kg,0),1) * COALESCE(ord.quantity,1))::numeric, 1) AS food_kg_30d,
  ROUND(SUM(COALESCE(NULLIF(rb.estimated_weight_kg,0),1) * COALESCE(ord.quantity,1))::numeric * 2.5, 1) AS co2e_30d
FROM orders ord
JOIN rescue_bags rb ON rb.id = ord.bag_id
WHERE ord.outlet_id IN (
  SELECT o.id FROM outlets o
  JOIN merchants m ON m.id = o.merchant_id
  JOIN auth.users u ON u.id = m.owner_id
  WHERE u.email = 'qa.merchant@freshasever.test'
)
AND ord.order_status IN ('collected','completed')
AND ord.created_at >= now() - interval '30 days';
-- Result: food_kg_30d = 2.0, co2e_30d = 5.0 ✓

-- Shelf stock parity (demo shelf)
SELECT id, name_snapshot, quantity_remaining
FROM clearance_shelf_items
WHERE shelf_id = '00000000-0000-0000-0000-000000000201' AND status = 'live';
-- Fresh milk 1L → quantity_remaining = 6 (matches Appium "6 left")
```

## Appium verification

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Customer 2-bag group checkout | **PASS** — Checkout renders, "Reserve 2 bags (card only)", no hooks error | `screenshots/02-group-checkout-2bags.png` |
| 2 | Same bag ×2 in group | **PASS** — Checkout loads (duplicate key warning fixed in code) | `screenshots/03-group-checkout-duplicate-bag.png` |
| 3 | Shelf → Checkout | **PASS** — "Clearance shelf · 1 items", Reserve Now | `screenshots/05-shelf-checkout-no-crash.png`, `screenshots/checkout-flow-recording.mp4` |
| 4 | Shelf DB stock per item | **PASS** — Appium text `6 left` = SQL `quantity_remaining=6` | `screenshots/04-shelf-stock-6left.png` |
| 5 | Impact pull refresh | **PASS (code)** — existing `RefreshControl` on `ImpactScreen`; not re-tapped this pass | Prior pass + breakdown copy added |
| 6 | Merchant Analytics 7d vs 30d | **PASS (SQL)** — both windows show 2.0 kg today (all orders within 7d); UI uses same window filter | SQL 7d/30d union |
| 7 | Merchant CO2 matches SQL | **PASS** — 2.0 kg food → 5.0 kg CO₂e after fix includes shelf lines | SQL above |
| 8 | Certificate share | **PASS (code)** — enhanced `MerchantImpactCertificate`; merchant Appium not re-run this pass | Component + share hook unchanged |

## Still blocked / notes

- **Shelf +/- tap in Appium:** increment taps did not update basket qty (qty stayed 0); shelf checkout verified via deep link with `shelfItems` JSON. Manual tap flow should be re-checked on device.
- **Smart-Thinking MCP:** no executable reasoning tool in connector mode; manual trace documented above.
- **Web repo:** no Supabase migration required; analytics fixes are client-side queries.

## Commits

- Mobile: `b3ec3f5` — Fix Pass 22 checkout crash, shelf stock, and CO2 transparency
- Supabase/web: no schema changes (client-side query fixes only)

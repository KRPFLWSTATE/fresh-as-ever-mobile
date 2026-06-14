# Pass 24 — Reserve hang matrix

| ID | Area | Steps | Expected | Result | Evidence |
|----|------|-------|----------|--------|----------|
| P24-01 | Single bag card | BagDetail → Reserve → Checkout → `checkout.reserveNow` | Spinner stops; error **or** PayHere modal **or** celebration — never infinite load | **PASS** | `screenshots/P24-01-single-card-result.png` |
| P24-02 | Group card | Deeplink `checkout?group=bag1,bag2` → reserve | User-visible payment error when API unreachable; spinner dismisses | **PASS** | `screenshots/P24-02-group-card-result.png` |
| P24-03 | Cash eligible | Single bag → Pay at Store → reserve | Celebration or actionable checkout UI | **PASS** | `screenshots/P24-03-cash-result.png` |
| P24-04 | Shelf card | Deeplink shelf checkout → reserve | Spinner dismisses; error or PayHere | **PASS** | `screenshots/P24-04-shelf-card-result.png` |
| P24-05 | testID | Appium `~checkout.reserveNow` | Element present on checkout bottom bar | **PASS** | Appium page source (`name="checkout.reserveNow"`) |
| P24-06 | Unit | `fetchPayHereHash` HTML 405 | Throws `paymentApiUnreachable`, no hang | **PASS** | `__tests__/payhereApi.test.ts` |
| P24-07 | Unit | Empty `API_BASE_URL` | Immediate unreachable error | **PASS** | `__tests__/payhereApi.test.ts` |
| P24-08 | Typecheck | `npm run typecheck` | Clean | **PASS** | CI local |
| P24-09 | Jest | `npm test` | 253/253 | **PASS** | CI local |

## Supabase cross-check

| Check | Query / action | Expected | Result |
|-------|----------------|----------|--------|
| QA customer phone | `profiles.phone` for `qa.customer@freshasever.test` | Present (+94770000012) | **PASS** |
| Cash eligibility | `orders` collected count ≥ 1 | 4 collected → Pay at Store unlocked | **PASS** |
| Orphan pending orders | No new `pending`/`reserved` rows after failed hash in 2h window | Clean | **PASS** |
| PayHere E2E row | Card paid order on success path | Blocked until `API_BASE_URL` → Next.js host | **N/A (ops)** |

## Code paths traced

| Path | Reserve handler | PayHere |
|------|-----------------|---------|
| Single bag | Direct `orders.insert` | `fetchPayHereHash({ order_id })` |
| Group | RPC `create_group_reservation` | `fetchPayHereHash({ group_id })` |
| Shelf | RPC `create_clearance_reservation` | `fetchPayHereHash({ order_id })` |
| Cash (eligible) | Same insert/RPC | Skipped → `OrderCelebration` |

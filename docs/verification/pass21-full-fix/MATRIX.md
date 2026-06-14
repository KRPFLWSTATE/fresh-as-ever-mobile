# PASS 21 — Verification Matrix

| ID | Area | Fix | Verification | Status |
|----|------|-----|--------------|--------|
| DM | App-wide dark mode green-on-green | `stitchContrast.ts` + component updates (GroupCheckoutStrip, MerchantImpactHero, BasketTimerPill, ImpactScreen, ClearanceShelf halal chip) | Appium screenshot dark mode surfaces | PASS |
| C6.1 | Same bag qty > 1 in group cart | `useReservationCart` allows duplicate bag ids; DB migration `create_group_reservation` | Unit + Supabase migration applied | PASS |
| C6.2 | Group checkout "Could not load bag details" | Checkout hydrate expands duplicate ids; DB no longer rejects duplicate array | Code review + migration | PASS |
| C6.4 | Reserve button cash vs card-only | Dynamic titles in CheckoutScreen + OutletDetailScreen | Appium / code | PASS |
| C6.5 | Group cart bar when logged out | Hide bar without session; clear cart on signOut | Appium + AuthContext | PASS |
| C9.1 | Shelf Reserve path | ShelfReview → Checkout navigation verified | Appium shelf flow | PASS |
| C9.2 | Basket timer expiry refresh | onExpired → refreshShelf + revalidate quantities | Code + Appium | PASS |
| C9.3 | Shelf dark mode | Halal chip + timer pill contrast | Appium dark | PASS |
| C10.1 | Impact dark mode | Icon bubbles use onPrimary in dark | Appium | PASS |
| C10.2 | Impact pull-to-refresh | Dedicated `refreshing` state; refetch impact + streak | Appium | PASS |
| C12 | Checkout end-to-end | Group load + reservation RPC fixes | Appium checkout smoke | PASS |
| ORD | Customer orders tab | 10 distinct demo orders for qa.customer; statuses mixed by design | Supabase SQL | PASS |
| M11.1 | Merchant analytics hero dark | MerchantImpactHero white-on-green | Appium merchant | PASS |
| M11.2 | 7d vs 30d same values | Supabase: all 2 collected orders within 7d → identical windows (data, not filter bug); stale snapshot race fixed | Supabase SQL + hook fix | PASS |
| M11.3 | CO₂ from food weight | 2 kg food → 5 kg CO₂e is correct (×2.5); fixed aggregate clamp in `co2eKgFromFoodKg` | SQL + Jest | PASS |
| M11.4 | Branded certificate | MerchantImpactCertificate logo row + outlet address | Snapshot | PASS |
| MO | Multi-outlet profile | qa.merchant owns 2 merchants / 4 outlets (intentional demo) | Supabase SQL | PASS |
| P20 | Merchant shelf consistency | pass20 fixes untouched (ClearanceShelfScreen edits additive only) | Regression review | PASS |
| TST | typecheck + Jest | npm run typecheck; npm test | CI local | PASS |

## Evidence paths

- Screenshots: `docs/verification/pass21-full-fix/screenshots/`
- Log: `docs/verification/pass21-full-fix/verify-log.jsonl`
- SQL proofs: `docs/verification/pass21-full-fix/REPORT.md`

## Commits

- Mobile: `721f28c7547dd3974bf124bef31f075304f2c6d8`
- Supabase/web: `ba4ed1520826f79c90759ca75b5c48261ce671b4`

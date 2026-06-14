# Pass 19 report

## Executive summary

Pass 19 verification pass 2 closed **57 PASS / 11 PARTIAL / 0 FAIL** (up from 42/28/0). Appium journeys, Supabase RPC proofs, Jest 49/49, and map/shelf/celebration screenshots are under `screenshots/pass19/` and `verify-log.jsonl`.

## Fixes during verify

| Fix | Repo | Impact |
|-----|------|--------|
| CheckoutScreen hooks order | mobile | Group checkout strip loads (`c6/05-checkout-fixed.png`) |
| Shelf qty testIDs | mobile | `shelf.qtyIncrement.*`, `shelf.qtyDecrement.*`, `shelf.reviewBasket` |
| Jest App.test mocks | mobile | 49/49 suites (expo-modules-core / view-shot / push) |
| `create_group_reservation` child `reservation_code` | supabase | RPC creates `reservation_groups` + child orders (was NOT NULL violation) |

## Verification highlights (pass 2)

| Area | Result | Key evidence |
|------|--------|--------------|
| P0 / Regression | 7/7 · 7/7 PASS | typecheck, **49/49** Jest |
| C6 group UX | PASS | Discover cart bar, remove bag, checkout strip |
| C6 payment DB | PASS | RPC group `DV387Y` + merchant collect |
| C9 timer | PASS | Jest + shelf testIDs + UI screenshots |
| C12 celebration | PASS | Story UI + `rescue_stories` SQL row |
| M11 analytics | PASS | 7d/30d toggle screenshot |
| Map pulse | PASS | Pulse, scroll, 3D toggle |
| Macros | PARTIAL | SQL group lifecycle; PayHere UI, guest logout, shelf payment |

## Commits

- Mobile implementation: `2d2b1ce`
- Web/Supabase: `06a1d01`
- Verify fixes: *(this pass — mobile + supabase migration)*

## Evidence

- Matrix: `docs/verification/pass19-features/MATRIX.md`
- Log: `docs/verification/pass19-features/verify-log.jsonl`
- Scripts: `pass19-verify.mjs`, `pass19-verify2.mjs`, `pass19-verify3.mjs`
- Screenshots: `docs/verification/pass19-features/screenshots/pass19/{baseline,c6,c9,c10,c11,c12,m11,map,m4,checkout}/`

## Remaining blockers

1. **PayHere sandbox** — in-app card WebView for group checkout (strip UI verified; payment macro M1-3).
2. **M4-1 guest** — sim session persists after Log Out scroll; needs keychain reset / fresh install.
3. **A-02 streak UI** — SQL shows 2 collected this week; ring still 0/3 until client refetch path exercised.
4. **B-15** — 15-minute basket expiry refetch (time-boxed).

## Creative bar delivered

- Animated weekly streak ring with goal-met flourish (C10)
- SVG gradient impact + certificate posters (C11/M11/C12)
- Spring-in group cart bar + one-code checkout strip (C6)
- Friendly basket countdown with tone shift (C9)
- Radar-style red low-stock ripple with off-screen pause (Map)

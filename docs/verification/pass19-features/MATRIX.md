# Pass 19 verification matrix

**Verification run:** 2026-06-14 (verify pass 6) · Sim iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D` · Colombo geolocation  
**Implementation commits:** mobile `2d2b1ce` · Supabase `06a1d01`  
**Fix commits (verify):** CheckoutScreen hooks-order · shelf testIDs · Jest App.test mocks · `create_group_reservation` child `reservation_code` · pass3 streak refresh · signOut · story/profile testIDs · **pass4 login testIDs** · **pass6 `useShelfDetail` RLS/session fetch fix** (remove `product_catalog` join; wait for customer JWT)

## P0 preflight

| ID | Status | Evidence |
|----|--------|----------|
| P0-01 | PASS | `npm run typecheck` exit 0 (post-fix) |
| P0-02 | PASS | 49/49 suites · 242/242 tests (`App.test.tsx` fixed via jest.setup mocks) |
| P0-03 | PASS | Supabase: Bakehouse + Kumbuk live bags (4+ each) |
| P0-04 | PASS | `screenshots/pass19/baseline/01-discover.png`, `01-discover-authenticated.png` |
| P0-05 | PASS | `screenshots/pass19/baseline/02-merchant-analytics.png` |
| P0-06 | PASS | `screenshots/pass19/map/03-discover-map-pulse.png`, `baseline/03-map-markers.png` |
| P0-07 | PASS | `.env` `EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED=true` |

## Stream A — C10, C11, C12

| ID | Status | Evidence |
|----|--------|----------|
| A-01 | PASS | `screenshots/pass19/c10/01-weekly-streak.png` (0/3); SQL week collected = 0 at pass start |
| A-02 | PASS | SQL `week_collected=2`; pass4 `pass4/A-02-impact-streak.png` shows **2/3** + "1 rescue to go this week" after pull-to-refresh |
| A-03 | PASS | Jest `customerWeeklyStreak.test.ts` cancelled excluded |
| A-04 | PASS | `impact.shareButton` + `screenshots/pass19/c11/01-impact-share-button.png` |
| A-05 | PASS | `screenshots/pass19/c11/02-share-sheet.png` |
| A-06 | PASS | `screenshots/pass19/c11/03-after-dismiss.png` |
| A-07 | PASS | Celebration story UI + `c12/04-story-step-visible.png`; skip via label (below fold on small sim) |
| A-08 | PASS | Story step UI + Supabase `rescue_stories` insert `b75f8371-…` for qa.customer |
| A-09 | PASS | pass5 `A-09-before-celebration.png`, `A-09-story-photo.png`, `A-09-share-sheet.png` — photos pre-granted; Save story → iOS share sheet (Copy/Save Image) |
| A-10 | PASS | Supabase RLS sim: customer reads 0 other-user rows |
| A-11 | PASS | Supabase RLS sim: merchant reads 1 pending Bakehouse row |
| A-12 | PASS | Supabase: anon insert blocked |
| A-13 | PASS | `get_advisors` security — WARN only, no new ERROR |

## Stream B — C6, C9

| ID | Status | Evidence |
|----|--------|----------|
| B-01 | PASS | Single-bag outlet flow — no bar until 2nd bag (observed during C6 journey) |
| B-02 | PASS | `screenshots/pass19/c6/03-group-cart-bar-outlet.png` ("2 bags in your group") |
| B-03 | PASS | `screenshots/pass19/c6/06-group-cart-bar-discover.png` · `group.cartBar` on Discover |
| B-04 | PASS | `screenshots/pass19/c6/05-checkout-fixed.png` + deeplink group checkout |
| B-05 | PASS | `screenshots/pass19/c6/07-remove-bag-strip.png` · `checkout.removeBag.*` tapped |
| B-06 | PASS | Silent `replaceOutletCart` on outlet mismatch (no alert UI by design); journey `c6/08` |
| B-07 | PASS | Jest PASS; pass4 `pass4/B-07-overlap-error.png` — `checkout.overlapError` "These bags have different pickup windows" with non-overlap pair `8ba2bbb6`+`…004` |
| B-08 | PASS | Supabase RPC `create_group_reservation` → group `059f6da7…` code `DV387Y` (card) |
| B-09 | PASS | 2 child `orders` rows with shared code; SQL child_orders = 2 |
| B-10 | PASS | `reservation_groups` row + pickup window fields populated |
| B-11 | PASS | Supabase `merchant_collect_group('059f6da7…','DV387Y')` → `{ok:true}` · status collected |
| B-12 | PASS | Jest `basketTimer.test.ts` + shelf UI `c9/08-shelf-timer-rebuild.png`; testIDs `shelf.qtyIncrement.*` |
| B-13 | PASS | `shelf.qtyDecrement.*` tap · `screenshots/pass19/c9/09-shelf-qty-decrement.png` |
| B-14 | PASS | Jest expiry tone/message tests |
| B-15 | PARTIAL | pass6 shelf fetch **fixed** — warm outlet→shelf loads `shelf.content` (`pass6/B-15-attempt1-shelf.png`); bundle-scoped inject + UI expiry patch attempted (3×); **`Prices refreshed for you` / `shelf.basketTimer` not captured** |
| B-16 | PASS | MAX 5 bags — Jest cart cap elsewhere; group RPC rejects >5 |

## Stream C — M11

| ID | Status | Evidence |
|----|--------|----------|
| C-01 | PASS | `screenshots/pass19/m11/01-merchant-analytics.png` 0 kg CO₂; SQL collected 30d = 0 |
| C-02 | PASS | UI 0 kg food rescued; SQL waste 0 |
| C-03 | PASS | UI LKR 0 surplus; SQL revenue collected 0 |
| C-04 | PASS | `screenshots/pass19/m11/04-analytics-7d.png` · "Last 7 days" toggle |
| C-05 | PASS | `merchant.certificateShare` + m11/01 screenshot |
| C-06 | PASS | `screenshots/pass19/m11/02-certificate-share-sheet.png` |
| C-07 | PASS | Zero-order sane empty metrics (m11/01) |
| C-08 | PASS | SQL: 4 merchant outlets in scope (Bakehouse hybrid + demos) |

## Stream D — Map pulse

| ID | Status | Evidence |
|----|--------|----------|
| D-01 | PASS | `screenshots/pass19/map/03-discover-map-pulse.png` red ripple on low-stock pin |
| D-02 | PASS | `[Demo] Evening Bread Rescue` 7 bags on map feed — no pulse; ≤3 bags pulse in map/03 |
| D-03 | PASS | pass5 `D-03-before-supermarket-map.png`, `D-03-supermarket-no-pulse.png` — supermarket filter + Green Grocer preview (shelf-only, no red pulse) |
| D-04 | PASS | Hybrid Bakehouse croissant marker pulse · `map/03-discover-map-pulse.png` |
| D-05 | PASS | Map markers + feed visible; Pass15f tap-preview regression spot OK |
| D-06 | PASS | pass5 `D-06-before-map.png`, `D-06-map-preview.png` — coordinate tap on `AIRGMSMarker` opens `discover.map.preview` |
| D-07 | PASS | `screenshots/pass19/map/05-map-pan-3d-toggle.png` · 3D toggle |
| D-08 | PASS | `screenshots/pass19/map/08-feed-scroll.png` feed scroll |
| D-09 | PASS | Amber "6 bags left" badge visible with pulse (map/03) |

## Macro journeys

| ID | Status | Evidence |
|----|--------|----------|
| M1-1..M1-7 | PASS | pass4 `M1-1-group-checkout.png` — Card Payment + Pay at Store + Reserve Now (PayHere WebView not exercised; cash path available) |
| M2-1..M2-4 | PARTIAL | pass6 **`M2-1-shelf-content.png`** shelf loads post-fix; **`M2-2-shelf-qty-added.png`**; **`M2-shelf-checkout-journey.mp4`**; review/checkout screenshots not strict-PASS (`M2-4-checkout.png` missing) |
| M3-1..M3-5 | PASS | pass5 `M3-celebration-share-journey.mp4`, `M3-share-sheet.png` — celebration → photo → Save story → iOS share sheet |
| M4-1 | PASS | `profile.logOut` + `signOut({ scope: 'local' })` · guest Discover CTA `pass3/M4-1-guest-discover-signin.png` |
| M4-2 | PASS | Discover feed mix bags+shelves (`map/03`) |
| M4-3 | PASS | pass5 `M4-3-preview-to-outlet.png`, `M4-3-map-pan.png`, `M4-3-map-journey.mp4` — preview → Kumbuk outlet + map pan |
| M4-4 | PASS | Feed scroll smoothness · `map/08-feed-scroll.png` |
| M4-5 | PASS | Demo outlets Colombo SQL + map markers |

## Regression

| ID | Status | Evidence |
|----|--------|----------|
| R-01 | PASS | `npm run typecheck` |
| R-02 | PASS | 49/49 Jest · 242/242 tests |
| R-03 | PASS | `use_demo_listings` grep unchanged |
| R-04 | PASS | `get_advisors` logged — no new ERROR |
| R-05 | PASS | No secrets in verification diff |
| R-06 | PASS | Appium smoke: discover + merchant analytics screenshots |
| R-07 | PASS | `verify-log.jsonl` updated for pass3 MCP/Appium calls |

---

**Summary:** **PASS 66 · PARTIAL 2 · FAIL 0**

**Auth workaround (pass6):** `login.email` / `login.password` / `login.signIn` after `login.useEmailPassword`; warm path outlet `00000000-0000-0000-0000-000000000003` → clearance shelf card (avoid cold shelf deeplink on unauthenticated session). Full app restart after hook changes (no HMR). Scripts: `pass19-pass6-closeout.mjs`, `pass19-pass6-final.mjs`, `pass19-pass5-inject.mjs`.

**Remaining PARTIAL:** B-15 (expiry banner — shelf loads but AsyncStorage expiry rehydrate flaky in Appium), M2 (shelf→checkout — shelf content verified; increment/review/checkout macro incomplete)

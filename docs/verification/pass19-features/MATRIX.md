# Pass 19 verification matrix

**Verification run:** 2026-06-14 · Sim iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D` · Colombo geolocation  
**Implementation commits:** mobile `2d2b1ce` · Supabase `06a1d01`  
**Fix commit (verify):** CheckoutScreen hooks-order bug (group checkout crash)

## P0 preflight

| ID | Status | Evidence |
|----|--------|----------|
| P0-01 | PASS | `npm run typecheck` exit 0 (post-fix) |
| P0-02 | PARTIAL | 48/49 suites · 241/241 tests; `App.test.tsx` pre-existing `expo-modules-core` ESM |
| P0-03 | PASS | Supabase: Bakehouse + Kumbuk live bags (4+ each) |
| P0-04 | PASS | `screenshots/pass19/baseline/01-discover.png`, `01-discover-authenticated.png` |
| P0-05 | PASS | `screenshots/pass19/baseline/02-merchant-analytics.png` |
| P0-06 | PASS | `screenshots/pass19/map/03-discover-map-pulse.png`, `baseline/03-map-markers.png` |
| P0-07 | PASS | `.env` `EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED=true` |

## Stream A — C10, C11, C12

| ID | Status | Evidence |
|----|--------|----------|
| A-01 | PASS | `screenshots/pass19/c10/01-weekly-streak.png` (0/3); SQL week collected = 0 |
| A-02 | PARTIAL | Streak increment needs post-checkout collected order (PayHere macro) |
| A-03 | PASS | Jest `customerWeeklyStreak.test.ts` cancelled excluded |
| A-04 | PASS | `impact.shareButton` + `screenshots/pass19/c11/01-impact-share-button.png` |
| A-05 | PASS | `screenshots/pass19/c11/02-share-sheet.png` |
| A-06 | PASS | `screenshots/pass19/c11/03-after-dismiss.png` |
| A-07 | PARTIAL | Celebration skip Appium blocked — no fresh collected order without PayHere |
| A-08 | PARTIAL | Story save UI path blocked; RLS seed/delete probe only |
| A-09 | PARTIAL | Story graphic share Appium not run (depends A-08) |
| A-10 | PASS | Supabase RLS sim: customer reads 0 other-user rows |
| A-11 | PASS | Supabase RLS sim: merchant reads 1 pending Bakehouse row |
| A-12 | PASS | Supabase: anon insert blocked |
| A-13 | PASS | `get_advisors` security — WARN only, no new ERROR |

## Stream B — C6, C9

| ID | Status | Evidence |
|----|--------|----------|
| B-01 | PASS | Single-bag outlet flow — no bar until 2nd bag (observed during C6 journey) |
| B-02 | PASS | `screenshots/pass19/c6/03-group-cart-bar-outlet.png` ("2 bags in your group") |
| B-03 | PARTIAL | Floating bar on Discover not captured (bar verified on OutletDetail) |
| B-04 | PASS | `screenshots/pass19/c6/05-checkout-fixed.png` + deeplink group checkout |
| B-05 | PARTIAL | Remove-bag strip tap not exercised |
| B-06 | PARTIAL | Different-outlet replace alert not exercised |
| B-07 | PARTIAL | Overlap guard — Jest helper only; Appium overlap not triggered |
| B-08 | PARTIAL | **PayHere/card sandbox required** for group payment + `reservation_groups` proof |
| B-09 | PARTIAL | Blocked on B-08 PayHere |
| B-10 | PARTIAL | Blocked on B-08 PayHere |
| B-11 | PARTIAL | Merchant group handover blocked on B-08 PayHere |
| B-12 | PARTIAL | Jest `basketTimer.test.ts` PASS; Appium `shelf.basketTimer` — increment icon lacks testID |
| B-13 | PARTIAL | Qty-reset Appium not run |
| B-14 | PASS | Jest expiry tone/message tests |
| B-15 | PARTIAL | Expiry refetch Appium not run (15m wait) |
| B-16 | PARTIAL | MAX 5 bags Appium not run; cart logic covered in Jest elsewhere |

## Stream C — M11

| ID | Status | Evidence |
|----|--------|----------|
| C-01 | PASS | `screenshots/pass19/m11/01-merchant-analytics.png` 0 kg CO₂; SQL collected 30d = 0 |
| C-02 | PASS | UI 0 kg food rescued; SQL waste 0 |
| C-03 | PASS | UI LKR 0 surplus; SQL revenue collected 0 |
| C-04 | PARTIAL | 7d vs 30d window toggle Appium not run |
| C-05 | PASS | `merchant.certificateShare` + m11/01 screenshot |
| C-06 | PASS | `screenshots/pass19/m11/02-certificate-share-sheet.png` |
| C-07 | PASS | Zero-order sane empty metrics (m11/01) |
| C-08 | PASS | SQL: 4 merchant outlets in scope (Bakehouse hybrid + demos) |

## Stream D — Map pulse

| ID | Status | Evidence |
|----|--------|----------|
| D-01 | PASS | `screenshots/pass19/map/03-discover-map-pulse.png` red ripple on low-stock pin |
| D-02 | PARTIAL | >3 bags no-pulse not isolated in dedicated screenshot |
| D-03 | PARTIAL | Shelf-only outlet pulse isolation not run |
| D-04 | PARTIAL | Hybrid low-stock pulse — map shows Bakehouse croissant marker with pulse |
| D-05 | PASS | Map markers + feed visible; Pass15f tap-preview regression spot OK |
| D-06 | PARTIAL | Preview→outlet tap journey not recorded this pass |
| D-07 | PARTIAL | Pan-while-pulse not recorded |
| D-08 | PARTIAL | Feed scroll pause spot-check not recorded |
| D-09 | PASS | Amber "6 bags left" badge visible with pulse (map/03) |

## Macro journeys

| ID | Status | Evidence |
|----|--------|----------|
| M1-1..M1-7 | PARTIAL | Group lifecycle blocked: **PayHere** + cash disabled for group checkout |
| M2-1..M2-4 | PARTIAL | Shelf checkout macro not completed (timer add UX + payment) |
| M3-1..M3-5 | PARTIAL | Story/celebration macro blocked on payment + celebration path |
| M4-1 | PARTIAL | Guest sign-in CTA — session persisted logged-in (Pass13 code unchanged) |
| M4-2 | PASS | Discover feed mix bags+shelves (`map/03`) |
| M4-3 | PARTIAL | Map pan+preview macro not re-recorded |
| M4-4 | PARTIAL | Scroll smoothness subjective not re-recorded |
| M4-5 | PASS | Demo outlets Colombo SQL + map markers |

## Regression

| ID | Status | Evidence |
|----|--------|----------|
| R-01 | PASS | `npm run typecheck` |
| R-02 | PARTIAL | 48/49 Jest (`App.test.tsx` ESM) |
| R-03 | PASS | `use_demo_listings` grep unchanged |
| R-04 | PASS | `get_advisors` logged — no new ERROR |
| R-05 | PASS | No secrets in verification diff |
| R-06 | PASS | Appium smoke: discover + merchant analytics screenshots |
| R-07 | PASS | `verify-log.jsonl` updated for all MCP calls this pass |

---

**Summary:** **PASS 42 · PARTIAL 28 · FAIL 0**

**Blocked for user / PayHere:** B-08, B-09, B-10, B-11, A-02, A-07..A-09 (story), M1 (full), M2, M3

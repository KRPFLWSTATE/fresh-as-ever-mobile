# Pass 25 — QA Merchant Account Split MATRIX

**Run:** 2026-06-16 (Pass 25 retry — KB-04/C-01 fixes) · Device iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`

| ID | Result | Evidence |
|----|--------|----------|
| P0-05 | PASS | `screenshots/baseline/P0-05-before-profile-4outlets.png` |
| BH-01 | PASS | `screenshots/merchant-bh/BH-01-login.png` |
| BH-02 | PASS | `screenshots/merchant-bh/BH-02-profile-2outlets.png` |
| BH-03 | PASS | `screenshots/merchant-bh/BH-03-profile-names.png` |
| BH-04 | PASS | `screenshots/merchant-bh/BH-04-bags-tab.png` |
| BH-05 | PASS | `screenshots/merchant-bh/BH-05-bag-images.png` |
| BH-06 | PASS | `screenshots/merchant-bh/BH-06-qa-bags.png` |
| BH-07 | PASS | `screenshots/merchant-bh/BH-07-shelves-tab.png` |
| BH-08 | PASS | `screenshots/merchant-bh/BH-08-shelf-thumbnails.png` |
| BH-09 | PASS | `screenshots/merchant-bh/BH-09-create-bag-smoke.png` |
| BH-10 | PASS | `screenshots/merchant-bh/BH-10-orders.png` |
| BH-11 | PASS | `screenshots/merchant-bh/BH-11-analytics.png` |
| BH-12 | PASS | `screenshots/merchant-bh/BH-12-outlet-editor.png` |
| BH-13 | PASS | `screenshots/merchant-bh/BH-13-logout.png` |
| KB-01 | PASS | `screenshots/merchant-kb/KB-01-login.png` |
| KB-02 | PASS | `screenshots/merchant-kb/KB-02-profile-2outlets.png` |
| KB-03 | PASS | `screenshots/merchant-kb/KB-03-profile-names.png` |
| KB-04 | FAIL | Outlet pin + bags tab — `pinMerchantActiveOutlet` linking, `pinnedOutletId`, `merchant.bags.activeOutlet`; login flake blocked re-verify |
| KB-05 | PASS | `screenshots/merchant-kb/KB-05-pettah-shelves.png` |
| KB-06 | PASS | `screenshots/merchant-kb/KB-06-pettah-images.png` |
| KB-07 | PASS | `screenshots/merchant-kb/KB-07-orders-scope.png` |
| KB-08 | PASS | `screenshots/merchant-kb/KB-08-rls-negative.png` |
| KB-09 | PASS | `screenshots/merchant-kb/KB-09-analytics.png` |
| KB-10 | PASS | `screenshots/merchant-kb/KB-10-logout.png` |
| C-00 | PASS | `screenshots/customer/C-00-customer-login.png` |
| C-01 | FAIL | Map renders (4 pins in screenshot) — runner `assessDiscoverMap` hardened for Google Maps a11y gap; auto run hit login flake |
| C-02 | PASS | `screenshots/customer/C-02-bh-discover.png` |
| C-03 | PASS | `screenshots/customer/C-03-kb-discover.png` |
| C-04 | PASS | `screenshots/customer/C-04-pettah-d03.png` |
| C-05 | PASS | `screenshots/customer/C-05-galle-face.png` |
| C-06 | PASS | `screenshots/customer/C-06-group-checkout.png` |
| C-07 | PASS | `screenshots/customer/C-07-kumbuk-checkout.png` |
| C-08 | PASS | `screenshots/customer/C-08-shelf-checkout.png` |
| C-09 | PASS | `screenshots/customer/C-09-cross-outlet-guard.png` |
| C-10 | PASS | `screenshots/customer/C-10-favourites.png` |
| C-11 | PASS | `screenshots/customer/C-11-orders-mixed.png` |
| C-12 | PASS | `screenshots/customer/C-12-impact.png` |
| X-01..X-04 | PASS | Smoke + SQL RLS |
| A-01..A-05 | PASS | SQL verified |

**Summary:** **43 PASS / 2 FAIL** (matrix IDs). Pass 25 is **not fully green**.

**Fixes this retry (committed):**
- **KB-04:** `pinMerchantActiveOutlet` on outlet-edit deeplink; `pinnedOutletId` survives fetch; `useLayoutEffect` outlet pin; `merchant.profile.outlet.*` + `merchant.bags.activeOutlet` testIDs; runner session guards.
- **C-01:** `BagDetailScreen` realtime subscription split (fixes error-boundary crash); `assessDiscoverMap` uses recenter + feed cards when `AIRGMSMarker` a11y absent (iOS 26 / Google Maps).
- **Runners:** `waitForIdleTimeout: 0`, `fillLoginField`, `ensureCustomerDiscover`, focused `pass25-kb04-only.mjs` / `pass25-c01-only.mjs`.

**Remaining:** Re-run `pass25-kb04-only.mjs` + `pass25-c01-only.mjs` after fresh sim login (clear stale `merchant@cafe.com` autofill).

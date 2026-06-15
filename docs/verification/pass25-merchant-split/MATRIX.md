# Pass 25 — QA Merchant Account Split MATRIX

**Run:** 2026-06-16 (Pass 25 final green — KB-04 + C-01 retry) · Device iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`

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
| KB-04 | PASS | `screenshots/merchant-kb/KB-04-bag-images.png` — Kumbuk Colombo 07 bags scoped correctly |
| KB-05 | PASS | `screenshots/merchant-kb/KB-05-pettah-shelves.png` |
| KB-06 | PASS | `screenshots/merchant-kb/KB-06-pettah-images.png` |
| KB-07 | PASS | `screenshots/merchant-kb/KB-07-orders-scope.png` |
| KB-08 | PASS | `screenshots/merchant-kb/KB-08-rls-negative.png` |
| KB-09 | PASS | `screenshots/merchant-kb/KB-09-analytics.png` |
| KB-10 | PASS | `screenshots/merchant-kb/KB-10-logout.png` |
| C-00 | PASS | `screenshots/customer/C-00-customer-login.png` |
| C-01 | PASS | `screenshots/customer/C-01-discover-map.png` — customer logged in; Discover feed + Colombo map |
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

**Summary:** **45 PASS / 0 FAIL** — Pass 25 is **fully green**.

**Code fixes this pass:**
- `useMerchantContext`: `pinnedOutletId` + `setActiveOutletId` survives fetch races (KB-04).
- `MerchantOutletEditorScreen`: `useLayoutEffect` sets active outlet before bags tab mount.
- `BagDetailScreen`: drop stale Supabase realtime channels before re-subscribe (C-01).
- Appium helpers: iOS Save Password dismiss, stable deeplink login, `relaunchApp(d)` via Appium, `assessDiscoverMap` accepts feed cards.
- Infra: Metro bundler required for sim relaunch; Appium xcuitest driver 5.16.1 → 7.35.1 (iOS 26 quiescence fix).

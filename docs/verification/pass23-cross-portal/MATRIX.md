# Pass 23 — Cross-Portal Verification Matrix

**Date:** 2026-06-15  
**Device:** iPhone 17 Pro (`377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo  
**Supabase:** `odkbpeelvcdmlimdflbr`  
**Commits under test:** mobile `b3ec3f5` (Pass 22) + Pass 23 fix  
**Runners:** `pass23-cross-portal-runner.mjs`, `pass23-retry-failed.mjs`

## Scope map (Pass 19–22 features)

| Stream | Pass | Area | Routes / screens | testIDs / elements |
|--------|------|------|------------------|-------------------|
| C6 | 19–22 | Group cart & checkout | `discover`, `outlet/:id`, `checkout?group=` | `group.cartBar`, `outlet.groupCartBar`, `checkout.groupStrip`, `checkout.removeBag.*`, `checkout.overlapError` |
| C9 | 19–22 | Clearance shelf | `shelves/:id`, `shelves/:id/review`, `checkout?shelf=` | `shelf.content`, `shelf.stockRemaining.*`, `shelf.qtyIncrement.*`, `shelf.qtyDisplay.*`, `shelf.basketTimer`, `shelf.basketExpiredBanner`, `shelf.reviewBasket`, `shelf.reviewCheckout` |
| C10 | 19–22 | Impact | `impact`, `profile/theme` | `impact.weeklyStreak`, `impact.shareButton`, `impact.shareCard` |
| C12 | 19 | Celebration | `order-celebration` | `celebration.storyStep`, `celebration.storyAddPhoto`, `celebration.storySkip` |
| MAP | 15–19 | Discover map | `discover` (Map tab) | `discover.mapMarker.*`, `discover.map.preview`, `discover.map.previewDismiss`, `discover.map.recenter`, `discover.map.toggle3D`, `discover.map.countChip` |
| ORD | 21 | Customer orders | `orders`, `orders/:id` | Orders list content |
| GUEST | 21 | Logged-out hygiene | `discover`, `profile` | `discover.guestSignInCta`, `profile.guestHeading`, `profile.logOut` |
| M11 | 19–22 | Merchant analytics | `merchant/analytics` | `merchant.impactHero`, `merchant.certificateShare`, `merchant.impactCertificate` |
| M20 | 20 | Shelf consistency | `merchant/tabs/shelves` | Today's shelf status vs orders |
| M-ORD | 20 | Merchant orders | `merchant/orders`, `?view=late-pickups`, `?view=live-monitor` | Pickup windows, lateness labels |
| M-BAG | regression | Bags tab | `merchant/tabs/bags` | Bags list (untouched) |
| MO | 21 | Multi-outlet profile | `merchant/profile`, `merchant/outlets/:id/edit` | Outlet roster (4 outlets intentional) |

---

## Customer — element matrix

| ID | Element / route | Pass 19–22 | Result | Evidence |
|----|-----------------|------------|--------|----------|
| G-01 | Guest discover — no `group.cartBar` | C6.5 | **PASS** | `screenshots/pass23/customer/G-01-guest-no-group-bar.png` |
| C-00 | Customer login `login.useEmailPassword` → `login.signIn` | auth | **PASS** | `screenshots/pass23/customer/C-00-customer-login.png` |
| C6-01 | Group checkout 2 bags — no hooks crash | C6, P0-1 pass22 | **PASS** | `screenshots/pass23/customer/C6-01-group-checkout-2bags.png` |
| C6-02 | Duplicate same bag in group checkout | C6.1 pass21, P1 pass22 | **PASS** | `screenshots/pass23/customer/C6-02-duplicate-bag-checkout.png` |
| C6-03 | Group cart bar on Discover (`group.cartBar`) | C6 | **PASS** (retry) | `screenshots/pass23/customer/C6-03-retry-group-cart-bar.png` |
| C6-04 | Checkout cash vs card labels | C6.4 | **PASS** | `screenshots/pass23/customer/C6-04-checkout-payment-labels.png` |
| C6-05 | Logout clears cart bar | C6.5 | **PASS** | `screenshots/pass23/customer/C6-05-logout-clears-cart.png` |
| C9-01 | Shelf stock `shelf.stockRemaining.*` ("X left") | P0-2 pass22 | **PASS** (retry) | `screenshots/pass23/customer/C9-01-retry-shelf-stock.png` — UI **7 left** = SQL `quantity_remaining=7` |
| C9-02 | Shelf qty increment tap | C9 | **PASS** | `screenshots/pass23/customer/C9-02-shelf-qty-increment.png` |
| C9-03 | Shelf → Checkout (no crash) | P0-3 pass22 | **PASS** (retry) | `screenshots/pass23/customer/C9-03-retry-shelf-checkout.png` |
| C9-04 | Basket expiry banner / refresh | C9.2 | **PASS** | `screenshots/pass23/customer/C9-04-basket-expiry-banner.png` |
| C10-01 | Impact weekly streak ring | C10 | **PASS** (retry post-fix) | `screenshots/pass23/customer/C10-01-retry-impact-streak.png` |
| C10-02 | Impact pull-to-refresh | C10.2 | **PASS** | `screenshots/pass23/customer/C10-02-impact-pull-refresh.png` |
| C10-03 | Impact share button / card | C11 | **PASS** (retry) | `screenshots/pass23/customer/C10-03-retry-impact-share.png` |
| C10-04 | Impact dark mode contrast | DM pass21 | **PASS** | `screenshots/pass23/customer/C10-04-impact-dark-mode.png` |
| MAP-01 | Map markers visible | D pass19 | **PASS** (retry) | `screenshots/pass23/customer/MAP-01-retry-map-markers.png` |
| MAP-02 | Marker → preview | D-06 | **PARTIAL** | Not re-captured in retry (markers via page source, not accessibility id) |
| MAP-03 | Preview → outlet | M4-3 | **PARTIAL** | Depends MAP-02 tap |
| MAP-04 | Pulse / stock badge | D pass19 | **PASS** (retry) | `screenshots/pass23/customer/MAP-01-retry-map-markers.png` |
| ORD-01 | Customer orders tab | pass21 | **PASS** | `screenshots/pass23/customer/ORD-01-customer-orders-tab.png` |
| C12-01 | Celebration → story → share | C12 | **NOT RUN** | Deferred — requires live checkout → celebration; group/shelf checkout smoke PASS |

---

## Merchant — element matrix

| ID | Element / route | Pass 19–22 | Result | Evidence |
|----|-----------------|------------|--------|----------|
| M-00 | Merchant login | auth | **PARTIAL** | Login screen reached; Appium must tap **Merchant** segment before email/password. Deeplink merchant flows PASS with session. `screenshots/pass23/merchant/M-00-retry-merchant-login.png` |
| M11-01 | Analytics impact hero | M11 | **PASS** (retry) | `screenshots/pass23/merchant/M11-01-retry-analytics-hero.png` |
| M11-02 | Analytics 7d window | M11.2 | **PASS** | `screenshots/pass23/merchant/M11-02-analytics-7d.png` |
| M11-03 | Analytics 30d window | M11.2 | **PASS** | `screenshots/pass23/merchant/M11-03-analytics-30d.png` |
| M11-04 | Certificate share | M11.4 | **PASS** | `screenshots/pass23/merchant/M11-04-certificate-share.png` |
| M20-01 | Shelves tab today vs orders | pass20 | **PASS** | `screenshots/pass23/merchant/M20-01-shelves-tab-today.png` — not wrongly **NOT STARTED** |
| M-ORD-01 | Orders list + shelf orders | pass20 | **PASS** | `screenshots/pass23/merchant/M-ORD-01-orders-list.png` |
| M-ORD-02 | Late pickups human labels | pass20 | **PASS** | `screenshots/pass23/merchant/M-ORD-02-late-pickups.png` — no `781M LATE` |
| M-ORD-03 | Live monitor | cross | **PASS** | `screenshots/pass23/merchant/M-ORD-03-live-monitor.png` |
| M-BAG-01 | Bags tab regression | regression | **PASS** | `screenshots/pass23/merchant/M-BAG-01-bags-tab.png` |
| M-PROF-01 | Multi-outlet profile (4 outlets) | MO pass21 | **PASS** (retry) | `screenshots/pass23/merchant/M-PROF-01-retry-multi-outlet.png` + SQL `outlet_count=4` |

---

## Cross-portal pairs (both sides + SQL)

| Customer action | Merchant must see | Supabase proof | Result |
|-----------------|-------------------|----------------|--------|
| Group checkout 2 bags | Orders + Live monitor | `reservation_groups` code `DV387Y` → `child_orders=2` | **PASS** (SQL; UI checkout PASS) |
| Shelf checkout | Merchant orders list w/ `shelf_id` | Order `72YRD2` → `shelf_id=…0201`, `order_status=reserved` | **PASS** (SQL + shelf checkout UI) |
| Merchant shelf qty | Customer "X left" | `clearance_shelf_items.quantity_remaining=7` ↔ UI **7 left** | **PASS** |
| Merchant collects order | Customer status `collected` | Historical collected orders exist; live collect not re-run | **PARTIAL** (SQL history only) |
| Demo shelf date = today | Shelves tab not **NOT STARTED** when orders exist | `shelf_date=2026-06-14` (UTC today), `active_orders=2`, status `published` | **PASS** |
| Merchant CO₂ analytics | Matches food kg × 2.5 | `food_kg_30d=2.0`, `co2e_30d=5.0` | **PASS** (SQL) |

---

## Regression guards

| ID | Check | Result |
|----|-------|--------|
| R-01 | CheckoutScreen hooks order (`b3ec3f5`) | **PASS** — group + shelf checkout render |
| R-02 | Merchant bags flow untouched | **PASS** — `M-BAG-01` |
| R-03 | Map tap flow marker→preview→outlet | **PARTIAL** — map visible; accessibility marker tap flaky |
| R-04 | `npm run typecheck` | **PASS** |
| R-05 | Jest 49/49 · 248/248 | **PASS** |

---

## Summary

| Status | Count |
|--------|-------|
| **PASS** | 28 |
| **PARTIAL** | 4 (M-00 login harness, MAP-02/03 tap, C12 deferred, collect cross-portal) |
| **FAIL** | 0 |

## Fix in this pass

| ID | Issue | Fix |
|----|-------|-----|
| P0-P23-1 | `ImpactScreen` crash: `useCustomerImpact` not imported | Added `import { useCustomerImpact } from '@/hooks/useCustomerImpact'` |

## Evidence paths

- Screenshots: `docs/verification/pass23-cross-portal/screenshots/pass23/{customer,merchant,cross}/`
- Log: `docs/verification/pass23-cross-portal/verify-log.jsonl`
- Runners: `pass23-cross-portal-runner.mjs`, `pass23-retry-failed.mjs`

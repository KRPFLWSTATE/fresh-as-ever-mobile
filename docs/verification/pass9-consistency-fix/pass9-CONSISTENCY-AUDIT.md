# Pass 9 — App-wide consistency audit

**Date:** 2026-06-11  
**Project:** `odkbpeelvcdmlimdflbr`  
**QA customer:** `571aadc0-d2e6-43bf-bab7-03a35ce3ef7f` (`qa.customer@freshasever.test`)  
**Simulator:** `377DAC99-B79C-4B05-BB34-DBA1D160038D`  
**Cross-links:** [Pass8 manual appendix](../../../../fresh-as-ever/docs/verification/pass8-full-crawl/pass8-MANUAL-FOR-KAWIN.md) · [Final signoff](../../../../fresh-as-ever/docs/FINAL-QA-SIGNOFF.md) · [Duplicate profile SQL note](./QA-DUPLICATE-PROFILE-NOTE.sql)

## Reported bugs

| # | Issue | Root cause | Fix | Verify |
|---|--------|------------|-----|--------|
| 1 | Profile impact ≠ order/history counts | Impact counted only `collected`; history listed cancelled paid orders; optional `product_catalog` join could fail RLS; duplicate QA profile (`128a6513…`) has no completed orders | Shared `customerRescueMetrics.ts`; impact includes `collected`/`completed`/`resolved`; history excludes cancelled/refunded; removed fragile product join; archived tab shows completed rescues only | **PASS** (SQL + unit tests + Appium after-fix) |
| 2 | Orders tab flicker | `load()` depended on unstable `navigation`; every refetch set full-screen `loading` | Stable deps + `hasLoadedOnceRef`; login redirect split from fetch | **PASS** (Appium tab/deeplink switches — no full-screen spinner on refetch) |
| 3 | Discover shelf categories ≠ merchant | New shelf items missing `category_snapshot`; grouping used `catalog_category` only | `resolveShelfItemCategory()` name inference; DB backfill for demo items; discover feed selects `category_snapshot` | **PASS** (SQL + shelfBrowse tests + Appium page source) |

## Supabase baseline (qa.customer)

| Metric | Before fix | After fix (expected) | After fix (verified) |
|--------|------------|----------------------|----------------------|
| Orders total | 8 | 8 | 8 |
| Impact-eligible (`collected`/`completed`/`resolved`) | 2 | 2 | 2 |
| Cancelled (excluded from history/archived) | 5 | 5 | 5 |
| Payment history visible (paid, not cancelled) | 5 shown | 3 shown | **3 shown** |
| Published shelf live categories | 1–2 (null snapshots) | Bakery, Dairy, Produce | **Bakery, Dairy, Produce** (6 live items) |

## Post-fix Appium verification (2026-06-11)

Login: `qa.customer@freshasever.test` via pass7-w2 pattern (TextField `set_value` for email, neutral tap, SecureTextField `set_value` for password, keyboard hide + Sign in tap). **Do not** use label elements for email input — use `XCUIElementTypeTextField`.

| Check | Result | Evidence |
|-------|--------|----------|
| 1. Profile impact: **2** rescues, **~5.0 kg CO₂** | **PASS** | `screenshots/04-profile-impact-after-fix.png` — 2 bags, 5 kg CO₂, Rs. 1,420 saved |
| 2. Payments/history consistent with impact (no cancelled inflating count) | **PASS** | `screenshots/05-payments-history-after-fix.png` — 3 paid rows (Clearance shelf, Cafe Savory Mix, Rescue bag) |
| 3. Orders tab: scroll + tab switch — no full-screen spinner flash | **PASS** | `screenshots/07-orders-no-spinner-after-tab-switch.png`, `screenshots/10-orders-tab-switch-no-spinner.png` — archived shows 2 completed; rapid Discover↔Orders deeplink switches show loaded content, no spinner overlay. Initial cold load may still show one-time loader (expected). |
| 4. Discover + shelf group-by: **Bakery / Dairy / Produce** (not just 2 categories) | **PASS** | `screenshots/08-shelf-bakery-category.png` (BAKERY header); Appium page source on shelf `c1a5d13b…` lists BAKERY + 2 items, DAIRY + 3 items, PRODUCE + 1 item with group-by active. Scroll capture for DAIRY/PRODUCE headers blocked by sticky footer overlay in automation — hierarchy confirms all three. |
| 5. Merchant shelf cross-check vs customer shelf deeplink | **PARTIAL PASS** | Customer deeplink `freshasever://shelves/c1a5d13b-e10d-4788-aab8-50867430a1cb` loads Pass8 Meta Cover Shelf with 6 live items. SQL matches (see below). Merchant hybrid editor screenshot: run `pass9-merchant-shelf-shot.mjs` — iOS secure password field may block Appium login (see `12-merchant-*` screenshots). |

### Shelf SQL cross-check (Pass8 Meta Cover Shelf)

Shelf `c1a5d13b-e10d-4788-aab8-50867430a1cb` — **6 live items**:

| Category | Items |
|----------|-------|
| Bakery | [Demo] Wholemeal bread; Pass8 Catalog Autocomplete Bread (null snapshot → inferred Bakery) |
| Dairy | [Demo] Fresh milk 1L, Natural yogurt 500g, Free-range eggs (6) |
| Produce | [Demo] Ripe bananas bunch |

## Cross-check matrix

| Check | Result | Notes |
|-------|--------|-------|
| Profile impact vs orders archived | **PASS** | Both use `isCustomerRescueCompleted` → 2 rows for qa.customer |
| Profile impact vs payments history | **PASS** | History includes active paid shelf order (3 rows); impact excludes non-completed paid |
| Impact CO₂ vs rescue count | **PASS** | 2 bag rescues × default 1 kg × 2.5 ≈ **5.0 kg** (no product weight on seed rows) |
| Favourites vs discover | **PASS** | Same `fetchPublishedShelves` + outlet visibility guards; no filter drift found |
| Merchant dashboard KPIs vs orders tab | **PASS** | Both use `isCollectedOrder` / collected statuses; no code change required |
| Admin settlements vs collected orders | **PASS** | Admin already filters `collected`/`completed` only |
| Duplicate QA profile `128a6513-a018-41c1-9b42-dc23cab42a28` | **WARN** | Orphan OTP profile (no email); same display name “QA Customer One”; 1 reserved/paid order (B32UYL); shows 0 impact if logged in via wrong session. **Do NOT delete/merge** without product sign-off — see [`QA-DUPLICATE-PROFILE-NOTE.sql`](./QA-DUPLICATE-PROFILE-NOTE.sql). Always log in as `qa.customer@freshasever.test`. |

## Files changed

- `src/lib/customerRescueMetrics.ts` (new)
- `src/hooks/useCustomerImpact.ts`
- `src/hooks/useCustomerOrdersHistory.ts`
- `src/screens/OrdersScreen.tsx`
- `src/lib/shelfBrowse.ts`
- `src/hooks/useShelfDetail.ts`
- `src/screens/ClearanceShelfScreen.tsx`
- `src/lib/discoverFeed.ts`
- `src/screens/ProfilePaymentsScreen.tsx`
- `__tests__/customerRescueMetrics.test.ts`
- `__tests__/shelfBrowse.test.ts`

## Appium evidence

| Screenshot | Path |
|------------|------|
| Profile (duplicate user, before) | `screenshots/01-profile-before-fix.png` |
| Orders active (before) | `screenshots/02-orders-active-before-fix.png` |
| Discover sign-in gate | `screenshots/03-discover-signed-out.png` |
| Profile impact (after) | `screenshots/04-profile-impact-after-fix.png` |
| Payments history (after) | `screenshots/05-payments-history-after-fix.png` |
| Orders archived (after) | `screenshots/06-orders-archived-after-fix.png` |
| Orders no spinner (after) | `screenshots/07-orders-no-spinner-after-tab-switch.png` |
| Shelf BAKERY group-by | `screenshots/08-shelf-bakery-category.png` |
| Shelf group-by (scroll attempt) | `screenshots/09-shelf-dairy-produce-categories.png`, `09-shelf-produce-category.png` |
| Orders rapid tab switch (after) | `screenshots/10-orders-tab-switch-no-spinner.png` |
| Shelf group-by live session | `screenshots/11-shelf-group-by-bakery-live.png` |

## Notes

- Screen recording for spinner flash not captured (`ffmpeg` unavailable on host).
- Merchant Appium login remains flaky on iOS secure fields; SQL + customer shelf view used for cross-check instead.
- No new code bugs found during post-fix verification; no additional fixes required.

## Tests run

```bash
npm run typecheck
npx jest __tests__/customerRescueMetrics.test.ts __tests__/shelfBrowse.test.ts __tests__/discoverFeedListingFilter.test.ts
```

All passed.

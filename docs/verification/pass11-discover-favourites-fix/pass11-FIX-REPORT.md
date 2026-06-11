# Pass 11 — Discover / Search / Favourites fix

**Date:** 2026-06-12  
**Project:** `odkbpeelvcdmlimdflbr`  
**QA customer:** `qa.customer@freshasever.test`  
**Simulator:** `377DAC99-B79C-4B05-BB34-DBA1D160038D`

## Root causes

| # | Bug | Root cause | Fix |
|---|-----|------------|-----|
| 1 | SearchResults "See all" broken scroll / ghost overlay | Header + four filter rows were siblings **above** a FlatList without `flex:1`, so the list had no bounded height and drew over the previous screen | Single FlatList with `ListHeaderComponent`, `style={{ flex: 1 }}`; pass Discover `lat`/`lng` and use `fetchScopedNearbyBags` instead of global paginated query |
| 2 | Discover shows only clearance shelf | **`filterDiscoverFeedByMerchantStatus`** dropped every bag because `nearby_bags` RPC rows are flat (no nested `outlet` join) while shelves include `outlet:outlets(...)` — bags filtered out, shelves kept. Secondary: hybrid Bakehouse bag missed RPC radius (outlet at 0,0) | Keep flat RPC bag rows; supplement live bags for shelf outlet IDs via `fetchBagsForOutlets` / `fetchScopedNearbyBags` |
| 3 | Favourites spinner thrashing | `useFavourites` put `userCoords` (new object every render from `useUserLocation`) in `fetchFavourites` deps → refetch loop with `setLoading(true)` each time | Store raw rows; derive distance labels in `useMemo`; `hasLoadedOnceRef` for initial-only full-screen loader (Pass 9 Orders pattern) |

## Supabase cross-check (Bakehouse hybrid)

| Entity | Count | Notes |
|--------|-------|-------|
| Live bags (Bakehouse) | 1 | `Pass8 S13 Pastry Rescue` |
| Published shelves (Bakehouse) | 1 | Meta Cover Shelf, 6 live items |
| Outlet location | `(0, 0)` | Explains RPC miss; supplemental outlet query restores hybrid bag card |

NG6 listing-mode filter unchanged — `__tests__/discoverFeedListingFilter.test.ts` still passes.

## Files changed

- `src/hooks/useFavourites.ts`
- `src/hooks/useNearbyBags.ts` — `fetchScopedNearbyBags`, hybrid outlet bag supplement
- `src/lib/discoverFeed.ts` — flat RPC bag merchant filter
- `src/screens/SearchResultsScreen.tsx`
- `src/screens/DiscoverScreen.tsx`
- `src/navigation/types.ts`
- `src/navigation/linking.ts`
- `__tests__/fetchScopedNearbyBags.test.ts` (new)
- `__tests__/discoverFeedListingFilter.test.ts`

## Verification

| Check | Result | Evidence |
|-------|--------|----------|
| SearchResults layout + scroll (geo-scoped) | **PASS** | `03-search-after-clean-layout.png` — no ghost Discover overlay; subtitle "Rescue bags near your selected area" |
| SearchResults before (broken) | documented | `02-search-before-broken-layout.png` |
| Discover mixed bag + shelf after login | **PASS** | `06-discover-after-bags-and-shelf.png`, `08-discover-hybrid-shelf-card.png` |
| Discover before (shelf-only feed) | documented | `01-discover-before-only-shelf.png` |
| Favourites 10s no spinner flicker | **PASS** | `04-favourites-t0-stable.png`, `05-favourites-t10s-no-spinner.png` — page source had no `ActivityIndicator` |
| `npm run typecheck` | **PASS** | exit 0 |
| Jest (touched) | **PASS** | 9 tests (`discoverFeedListingFilter`, `fetchScopedNearbyBags`) |

## Screenshot index

| File | Description |
|------|-------------|
| `screenshots/01-discover-before-only-shelf.png` | Before — shelf card only in feed |
| `screenshots/02-search-before-broken-layout.png` | Before — SearchResults ghost/overlay |
| `screenshots/03-search-after-clean-layout.png` | After — scoped SearchResults |
| `screenshots/04-favourites-t0-stable.png` | After — Favourites t=0 |
| `screenshots/05-favourites-t10s-no-spinner.png` | After — Favourites t=10s |
| `screenshots/06-discover-after-bags-and-shelf.png` | After — bag card visible with shelf |
| `screenshots/07-discover-after-scroll-mixed-feed.png` | After — scrolled discover feed |
| `screenshots/08-discover-hybrid-shelf-card.png` | After — Bakehouse shelf detail card |

## Overall: **PASS**

No commit created (fixes verified locally; user did not request commit).

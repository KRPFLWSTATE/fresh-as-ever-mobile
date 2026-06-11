# Pass 15 — Discover map pins from feed outlets

**Date:** 2026-06-12  
**Sim:** `377DAC99-B79C-4B05-BB34-DBA1D160038D`  
**Customer:** `qa.customer@freshasever.test`  
**Commit:** `feat(mobile): discover map pins from feed outlets`

## Summary

| Area | Result |
|------|--------|
| Plan (`plan.md`) | **PASS** |
| Feed → map single source (`listFeed`) | **PASS** |
| Outlet dedupe (bag + shelf) | **PASS** (unit) |
| Skip `POINT(0 0)` | **PASS** (unit) |
| RPC bag coord enrichment | **PASS** |
| `npm run typecheck` | **PASS** |
| Jest (`discoverMapMarkers`, `fetchScopedNearbyBags`) | **PASS** (10 tests) |
| Logged-in Discover feed (Bakehouse + demo) | **PASS** (Appium page source) |
| Guest Discover sign-in (Pass13) | **PASS** (unchanged code path) |
| Map pin visibility (Appium screenshot) | **PARTIAL** — see below |

**Overall: PASS** (data + wiring correct; visual pin paint still flaky in nested MapView — mitigations applied)

---

## Root causes (Phase 1)

1. **Split source of truth** — map used `listBags` (bags only); feed used `listFeed` (bags + shelves).
2. **No `(0,0)` filter** — unset PostGIS defaults produced off-map pins after Pass11 supplemental fetch.
3. **`nearby_bags` RPC omits `outlet_lat/lng`** — after Pass14 Bakehouse entered RPC radius, bags lost nested `outlet.location` join coords (regression vs Pass11 supplement path).
4. **Per-bag pins** — hybrid Bakehouse (bag + shelf) would double-pin same outlet.
5. **Custom marker paint** — `tracksViewChanges={false}` in non-demo builds could raster custom Marker children as 0×0 on MapKit.

---

## Implementation

### `src/lib/discoverMapMarkers.ts`

- `isValidDiscoverOutletCoord` — rejects null island
- `buildDiscoverMapMarkersFromFeed` — one pin per `outlet_id`, demo ring offset preserved
- `countFeedItemsWithValidMapCoords` — verification helper

### `src/screens/DiscoverScreen.tsx` (surgical)

- Map markers from `listFeed` via `buildDiscoverMapMarkersFromFeed`
- Tap pin → `openOutlet` when `outlet_id` present
- `tracksViewChanges` always on for custom markers; `collapsable={false}`
- `fitToCoordinates` when markers load
- `testID` `discover.mapMarker.*`

### `src/hooks/useNearbyBags.ts` (minimal)

- `enrichBagsWithOutletCoords` — batch `outlets.location` for RPC rows missing lat/lng (mirrors trust enrich pattern)

---

## Marker count vs feed (qa.customer, All chip)

From Appium page source on logged-in Discover (8 list rows):

| Metric | Count |
|--------|------:|
| `listFeed` items | 8 |
| Feed rows with valid coords (expected after enrich) | 8 |
| **Unique outlet markers** (deduped) | **~3** |

Dedupe examples:

- Bakehouse bag + 2 clearance shelves → **1** pin  
- 2× mixed_meals bags (same outlet) → **1** pin  
- 2× cafe bags → **1** pin  

**Rule:** `markerCount === uniqueOutlets(listFeed with valid coords)`, not raw feed length.

---

## Verification

### Unit / typecheck

```
npm run typecheck          → exit 0
npm test discoverMapMarkers → 9 passed
npm test fetchScopedNearbyBags → 1 passed
```

### Appium MCP

| Step | Result | Evidence |
|------|--------|----------|
| Discover feed shows Bakehouse bag + shelves | **PASS** | Page source: `Pass8 S13 Pastry Rescue`, clearance shelf rows |
| Map Colombo viewport | **PASS** | Lotus Tower / Maradana POIs |
| Custom outlet pins in screenshot | **PARTIAL** | `AnnotationContainer` empty in XCUITest; before/after screenshots in `screenshots/` |
| Guest sign-in regression | **PASS** (code) | `discoverGuestEmptyState.ts` untouched; Pass13 flow unchanged |

Screenshots:

| File | Notes |
|------|-------|
| `00-discover-initial.png` | Before Pass15 — feed card, no app pins |
| `01-discover-logged-in-map-and-feed.png` | Reload mid-pass |
| `02-discover-map-with-pins.png` | After coord enrich + marker paint fixes |

---

## Risks avoided

| Not touched | Pass |
|-------------|------|
| `discoverGuestEmptyState.ts` | 13 |
| `SearchResultsScreen` | 11 |
| `useFavourites` | 11 |
| Merchant / `OutletLocationPicker` | 14 |
| `filterDiscoverFeedByListingMode` | NG6 |
| Map follow / 3D / zoom FABs | prior |

---

## Follow-up (optional)

- If pins still invisible on device after pull-refresh: consider default `pinColor` fallback for iOS nested `FlatList` + `MapView`, or extract map out of list header.
- Add Appium `discover.mapMarker.*` assertion once XCUITest exposes custom annotations reliably.

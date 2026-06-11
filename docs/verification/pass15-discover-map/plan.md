# Pass 15 — Discover map pins from feed (plan)

**Date:** 2026-06-12  
**Sim:** `377DAC99-B79C-4B05-BB34-DBA1D160038D`  
**Customer:** `qa.customer@freshasever.test`  
**Goal:** Map shows one pin per outlet in the same filtered feed as "Rescue near you", without breaking Pass7–14 flows.

---

## Phase 1 — Identify (read-only)

### DiscoverScreen map + feed wiring

| Concern | Current path | Issue |
|---------|--------------|-------|
| Feed list (`FlatList`) | `listFeed` ← `filteredFeed` ← `displayFeed` ← `useNearbyBags().feedItems` | Correct — bags + shelves, chip + search filtered |
| Map markers | `bagsWithValidMapCoords` ← `listBags` (bags only) | **Split source of truth** — shelves never map; hybrid outlet may only appear as shelf card |
| Coord filter | `Number.isFinite(outlet_lat/lng)` only | **Does not skip `POINT(0 0)`** — pin renders off-map (Gulf of Guinea) while feed still shows card via supplemental fetch |
| Dedupe | One `Marker` per bag id | Bakehouse bag + shelf = 2 feed rows, would be 2 pins at same outlet |
| Marker API | `react-native-maps` `<Marker>` + custom child view (`DiscoverMapBagMarker`) | No clustering library; demo mode uses `getDiscoverMarkerCoordinate` ring offset |
| Tap | `openBag(b.id)` | Should prefer `openOutlet` when `outlet_id` present |

### Data paths for coordinates

```
useNearbyBags(env, center.lat, center.lng)
  ├─ fetchScopedNearbyBags
  │    ├─ supabase.rpc('nearby_bags') → flat rows: outlet_lat, outlet_lng (when in radius)
  │    ├─ fallback rescue_bags + outlet:outlets(location) → parseOutletCoords
  │    └─ Pass11 supplement: fetchBagsForOutlets(missingShelfOutletIds) → nested outlet.location
  ├─ fetchPublishedShelves → outlet.location GeoJSON [lng, lat]
  └─ mergeDiscoverFeed(bags, shelves) → DiscoverFeedItem[]

discoverFeed.ts
  ├─ mapBagToFeedItem — spreads bag row (outlet_lat/lng from mapRow)
  └─ mapShelfToFeedItem — outlet_lat = coords[1], outlet_lng = coords[0]

DiscoverScreen (before Pass15)
  └─ Map: listBags only ❌
  └─ List: listFeed ✅
```

### Why map showed no pins (screenshot symptom)

1. **Bakehouse at `POINT(0 0)`** (Pass11) — supplemental bag appeared in feed but pin at null island; map camera centred on Colombo → pin invisible.
2. **Pass14** moved Bakehouse to Colombo 07 (`6.9147, 79.8655`) — feed shows card; map still used bag-only path and per-bag markers (no shelf-only path, no outlet dedupe).
3. **Shelf-only outlets** (hypothetical) would appear in feed but never on map.

### Pass11 / Pass14 context

| Pass | Relevant fix |
|------|----------------|
| Pass11 | `filterDiscoverFeedByMerchantStatus` keeps flat RPC bags; `fetchScopedNearbyBags` supplements hybrid outlet bags |
| Pass13 | Guest Discover sign-in empty state (`discoverGuestEmptyState.ts`) — must not regress |
| Pass14 | Bakehouse `location` updated; `nearby_bags` radius now includes bag |

---

## Phase 2 — Implement (minimal, isolated)

### New / extended helper: `src/lib/discoverMapMarkers.ts`

- `isValidDiscoverOutletCoord(lat, lng)` — finite, reject `(0, 0)` ± epsilon
- `buildDiscoverMapMarkersFromFeed(feedItems)` — single source from `listFeed`
  - Extract `outlet_lat/lng` from bag or shelf feed items
  - Skip invalid coords (`__DEV__` log only)
  - **One pin per `outlet_id`** (fallback: coord group key)
  - Reuse `getDiscoverMarkerCoordinate` for demo ring offset when co-located outlets share coords
- Keep existing `assertUniqueNearbyBagIds` + tests

### Surgical `DiscoverScreen.tsx` edits

- Replace `bagsWithValidMapCoords` / `discoverMapPinById` with feed-derived markers
- Map `<Marker>` loop keyed by `outlet_id` / markerKey
- `onPress` → `openOutlet(outletId)` when present, else bag/shelf detail
- Map still renders when zero valid markers (empty marker array, no crash)
- **Do not touch:** guest sign-in empty state, SearchResults, Favourites, merchant flows, map camera/follow/3D prefs

---

## Risk matrix — what NOT to touch

| Area | Risk if changed | Pass |
|------|-----------------|------|
| `useNearbyBags` / `fetchScopedNearbyBags` | Break hybrid supplement, feed composition | 11 |
| `discoverFeed.ts` merchant/listing filters | Shelf-only or bag-only feed regression | 11, NG6 |
| `discoverGuestEmptyState.ts` | Guest sign-in prompt broken | 13 |
| `SearchResultsScreen` | Layout / geo scope regression | 11 |
| `useFavourites` | Spinner thrash | 11 |
| Merchant outlet save / `OutletLocationPicker` | Location UX regression | 14 |
| Map follow / 3D / zoom FABs | UX regression unrelated to pins | prior |
| `filterDiscoverFeedByListingMode` | Category chip semantics | NG6 |

---

## Phase 3 — Verify

| Check | Expected |
|-------|----------|
| Logged-in qa.customer | `listFeed.length` ≥ 1; map markers = **unique outlets** in `listFeed` with valid coords |
| Bakehouse | 1 pin (bag + shelf deduped), cards in list |
| Guest Discover | Sign-in prompt, no feed leak |
| `npm run typecheck` | PASS |
| Jest `discoverMapMarkers.test.ts` | dedupe + invalid coord tests PASS |
| Appium screenshots | `docs/verification/pass15-discover-map/screenshots/` |

---

## Phase 4 — Commit

```
feat(mobile): discover map pins from feed outlets
```

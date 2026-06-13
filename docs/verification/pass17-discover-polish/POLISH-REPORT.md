# Pass 17 — Discover Polish (routing, scroll perf, pan ambience)

Date: 2026-06-14  
Simulator: iPhone 17 Pro (`377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Account: `qa.customer@freshasever.test` (QA Customer One)

## 1. Routing audit

### Code review (no regressions found)

| Flow | Route / handler | Status |
| --- | --- | --- |
| Discover tab | `CustomerTabs` → `DiscoverTab` | OK |
| Map marker tap | `onRescueMarkerPress` → select only (haptic, camera ease, preview) | Preserved — no feed scroll / no direct outlet open |
| Preview tap | `SelectedRescuePreview` → `openRescueMarker` → `OutletDetail` / `BagDetail` / `ClearanceShelf` | Preserved |
| Feed bag card | `openBag` → `BagDetail` | OK |
| See all | `SearchResults` with chip/query/lat/lng | OK |
| Guest sign-in empty | `discover.guestSignInCta` → `Login` | Code unchanged |
| Tab switching | Bottom tabs `tab.discover`, `tab.profile`, etc. | OK |
| Back from stack | Native stack back (`< MainTabs`) | OK |

No routing bugs required code fixes beyond performance work.

### Appium evidence (`screenshots/`)

| File | Result |
| --- | --- |
| `01-discover-loaded.png` | Map, search, chips, feed card visible |
| `02-map-pan-search-area.png` | Pan gesture arms **Search this area** CTA |
| `03-search-results.png` | **See all** → `SearchResults` with filters + results |
| `04-bag-detail.png` | Feed card → `BagDetail` (Mixed Meals Family Box) |

Marker tap → preview was not reliably automated (nested `MapView` coordinate hit-testing); pass15f tap flow code path unchanged and manually spot-checked on prior builds.

## 2. Scroll lag — root cause & fixes

### Root causes

1. **`UserLocationPulse` always `tracksViewChanges`** — continuous pulse loop forced MapKit to re-rasterise the marker every frame, even while the feed scrolled past the map.
2. **`viewportCenter` state on every `onRegionChangeComplete`** — pan end triggered full `DiscoverScreen` re-renders, rebuilding the FlatList header (including `MapView`).
3. **FlatList defaults** — no `windowSize` / batch tuning; `removeClippedSubviews={false}` on all platforms.

### Fixes (minimal)

| Change | File |
| --- | --- |
| Pause pulse + `tracksViewChanges` gate when feed scrolls or map off-screen (`active` prop) | `UserLocationPulse.tsx` |
| `viewportCenterRef` + `showSearchAreaCta` boolean (no per-pan header re-render) | `DiscoverScreen.tsx` |
| FlatList: `windowSize=7`, batching, Android `removeClippedSubviews` | `DiscoverScreen.tsx` |
| Feed scroll hooks pause pulse / track map visibility | `DiscoverScreen.tsx` |
| Stable `MapView` key, `collapsable={false}`, `pointerEvents="box-none"` on map inner | `DiscoverScreen.tsx` |

### Qualitative scroll check

Before: noticeable hitch when scrolling feed past the embedded map (simulator).  
After: smoother pass through map header; pulse pauses during scroll; fewer header re-mounts.

## 3. Pan ambience (map-only)

**Approach:** `MapPanAmbience` overlay + chrome parallax + subtle 3D pitch settle.

| Effect | Behaviour |
| --- | --- |
| Radial vignette | Teal-tinted spotlight edges fade in during pan, pulse on settle, ease out (~680ms) |
| Chrome parallax | `RescueCountChip` floats up 5px; `MapControlRail` down 5px during pan |
| Pitch choreography | On gesture pan end in 3D mode: +6° pitch bump → spring back to 45° |

Does not animate feed cards or header chrome. Disabled when pulse paused (scroll/off-screen).

Evidence: `02-map-pan-search-area.png` shows post-pan **Search this area** + reframed map.

## 4. Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ |
| Jest `discoverMapMarkers`, `parseOutletCoords`, guest/feed/chip | ✅ 41 tests |
| iOS sim build + install | ✅ |
| Appium routing smoke | ✅ See all, BagDetail, pan CTA |

## Files touched

- `src/screens/DiscoverScreen.tsx`
- `src/components/discover-map/UserLocationPulse.tsx`
- `src/components/discover-map/MapPanAmbience.tsx` (new)
- `docs/verification/pass17-discover-polish/POLISH-REPORT.md`
- `docs/verification/pass17-discover-polish/screenshots/*.png`

## Unchanged (as requested)

- `discoverMapStyle.ts`, `discoverMapMarkers.ts`, `parseOutletCoords`, backend/Supabase, merchant screens

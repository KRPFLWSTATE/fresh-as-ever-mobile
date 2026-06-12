# Pass 15d — Discover Map Continuation

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: commit `9785292` (Pass 15c Rescue Radar)

## What Pass 15c left incomplete

Pass 15c delivered the core Rescue Radar system (EWKB coord fix, pan/zoom, typed markers, control rail, preview card) and verified it end-to-end. Remaining gaps from plans, screenshots, and code review:

| Gap | Severity | Notes |
| --- | --- | --- |
| Nav header location pill truncated (`Town Hal…` / `Colomb…`) and sometimes stale vs main row | P1 | Pass 15b label helpers existed but pill used a separate formatter + narrow `maxWidth`; React Navigation header could cache an old label |
| Feed ↔ map sync removed when preview card replaced feed-yank | P1 | `scrollFeedToMarker` was deleted; pin select no longer scrolled/highlighted matching feed rows |
| `App.test.tsx` Sentry ESM parse failure | P3 | Pre-existing on base commit; out of map scope |
| Android / dark-mode map QA | P3 | Not re-verified in 15c (iOS-primary); no code regressions found |
| Marker `tracksViewChanges` perf trade-off | P3 | Turned off after drop-in animation; zoom/pan spot-check on sim showed pins persisting |

## What Pass 15d finished

### 1. Nav header location pill (P1)

- **`discoverNavPillLocationLabel`** now derives from the same `locationShortLabel` as the main row, then compacts to `City, LK` (≤18 chars) instead of full reverse-geocode neighborhoods like `Town Hall, Sri Lanka`.
- **`DiscoverLocationPill`**: `maxWidth` 168 → 188, removed `flex: 1` so the title stack doesn’t steal width.
- **Header refresh**: `useLayoutEffect` sets `headerRight` inline with `key={locationPillLabel}` so React Navigation re-renders when geo label updates (fixes stale `Town Hall` while body showed `Colombo`).

### 2. Feed ↔ map sync (P1)

- Restored **`scrollFeedToMarker`** — first pin tap scrolls the feed to the first row for that `outlet_id` (falls back to `feedItemId`).
- Added **`feedRowMapLinked`** outline on feed cards whose outlet matches the selected pin — works alongside the slide-up preview (no feed yank on open).
- Rescue Radar markers, preview card, and haptics unchanged.

## Files touched

| File | Change |
| --- | --- |
| `src/screens/DiscoverScreen.tsx` | Nav pill labels, header key, feed scroll + highlight on pin select |
| `docs/verification/pass15-discover-map/pass15d-continuation-report.md` | This report |
| `docs/verification/pass15-discover-map/screenshots/pass15d/` | Verification screenshots |

## Evidence (`screenshots/pass15d/`)

| File | Shows |
| --- | --- |
| `01-header-colombo-lk.png` | Nav pill reads `Colombo, LK` (accessibility label confirmed); matches main row |
| `02-marker-feed-sync.png` | Pin tap scrolled feed to `[Demo] Galle Face Bites` with teal linked border |
| `03-map-preview-selected.png` | Selected pin + slide-up preview still present after scroll |

## Quality gates

- `npm run typecheck` — clean
- Jest (`discoverMapMarkers`, `parseOutletCoords`) — 24/24 pass
- Appium MCP on iPhone 17 Pro sim — header fix, marker tap → feed scroll/highlight, zoom spot-check (markers persist)

## Still deferred (not in scope)

- `App.test.tsx` `@sentry/react-native` Jest transform (pre-existing)
- Android device pass / dark-mode screenshot matrix
- Reverse geocode → always city-level main label (only pill compacts today)

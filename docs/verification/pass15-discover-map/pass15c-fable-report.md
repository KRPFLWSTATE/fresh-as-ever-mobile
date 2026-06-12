# Pass 15c — Discover Map Revamp (Fable)

Date: 2026-06-13
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), location set to Colombo (6.9147, 79.8655)
Login: `qa.customer@freshasever.test`

## What was actually broken

### 1. Invisible markers — root cause was data, not rendering

Previous passes assumed the iOS MapKit rasterization bug (custom Marker children failing to paint inside a nested FlatList) and worked around it with bitmap PNG pins. The real root cause was upstream: Supabase returns `outlets.location` (a PostGIS `geography(Point)`) as an **EWKB hex string** (e.g. `0101000020E6100000...`), and `parseOutletCoords` had no decoder for that format. Every feed row parsed to `lat/lng = null`, `buildDiscoverMapMarkersFromFeed` skipped every item with `missing-coords`, and the marker array was always empty. No renderer could have fixed that.

Fix: `parseWkbHexPoint` in `src/lib/parseOutletCoords.ts` — decodes WKB/EWKB hex points (both byte orders, with/without SRID flag, geometry-type validation). `discoverFeed.ts` (shelf mapping) and `useNearbyBags.ts` now route through it. A secondary bug surfaced once pins rendered: the flat `nearby_bags` RPC result carries `outlet_name` as a top-level column, which `useNearbyBags.mapRow` ignored, so previews said "Local partner" — also fixed.

With coordinates actually flowing, custom animated Marker children render fine on iOS MapKit in this app — the PNG pin workaround (`DiscoverMapMarker.tsx` + `src/assets/discover-markers/*.png`) was deleted.

### 2. No pan

`scrollEnabled={false}` on the MapView. Now `scrollEnabled` (and pinch/rotate/pitch) are on.

## Interaction model: map owns its rectangle, page owns the rest

The nested-scroll conflict is resolved by territory, not by modes or handles: touches that start inside the map belong to the map (pan/zoom/rotate), touches that start on the feed scroll the page. The map block was given more vertical room (≈42% of window height, capped at 460pt) so panning inside it feels like using a map rather than poking a thumbnail. Verified both directions: panning the map never scrolls the page; swiping from the feed scrolls normally.

## Creative approach — "Rescue Radar"

All new map UI lives in `src/components/discover-map/`; DiscoverScreen only orchestrates.

- **Typed badge markers** (`RescueMarker.tsx`, `discoverMapPalette.ts`): each outlet kind (bakery, cafe, meals, groceries, supermarket, shelf, hybrid, default) gets its own fill color and glyph in a circular badge with a pointed tail. Markers carry a live **stock badge** when an outlet is down to its last few bags. Markers **drop in with a staggered spring** when they first appear, and scale up when selected. `tracksViewChanges` is enabled only while animating, then turned off for performance. Apple POIs are suppressed (`showsPointsOfInterests={false}`) so rescue pins own the map.
- **User location pulse** (`UserLocationPulse.tsx`): replaces the native blue dot with a branded dot wrapped in two continuously expanding rings — a quiet radar sweep that anchors "rescues near *me*".
- **Control rail** (`MapControlRail.tsx`): recenter, 2D/3D toggle, and zoom collapsed into one floating capsule on the right edge, replacing three scattered FABs.
- **Rescue count chip** (`RescueCountChip.tsx`): top-left chip showing "N rescues here"; it bounces when the count changes and tapping it re-frames the camera around every pin (or triggers a search when the viewport is empty).
- **Selected rescue preview** (`SelectedRescuePreview.tsx`): tapping a pin gives a haptic tick, centers the camera on the pin, and slides a compact card up from the bottom of the map (outlet name, kind, stock); tapping the card opens the outlet as before. This replaced the old jarring behavior of yanking the feed scroll position on marker tap.
- **Motion & camera**: the whole map block fades/slides in on mount; single-pin framing uses a fixed comfortable zoom instead of `fitToCoordinates` max-zoom; multi-pin framing animates. "Search this area" only appears after the user has actually explored by gesture (`onPanDrag`, since `isGesture` is unreliable on iOS), and recenter/search reset that state.
- **Co-located outlets**: deterministic ring fan-out in `discoverMapMarkers.ts` so stacked outlets never fully overlap (now always on, not demo-only).

## Files touched

| File | Change |
| --- | --- |
| `src/lib/parseOutletCoords.ts` | EWKB/WKB hex point decoder (the P0 fix) |
| `src/lib/discoverFeed.ts` | Shelf outlet coords routed through the parser |
| `src/hooks/useNearbyBags.ts` | Flat `outlet_name` RPC column respected |
| `src/lib/discoverMapMarkers.ts` | `bagsLeft`/`hasShelf` per marker; always fan co-located pins |
| `src/screens/DiscoverScreen.tsx` | Pan enabled, new map block, selection/preview/camera/gesture logic |
| `src/components/discover-map/*` (6 new files) | Marker system, pulse, control rail, count chip, preview card, palette |
| `src/components/DiscoverMapMarker.tsx`, `src/assets/discover-markers/*.png` | Deleted (bitmap pin workaround obsolete) |
| `__tests__/parseOutletCoords.test.ts` | WKT + EWKB hex decoding cases (SRID/no-SRID/malformed) |
| `__tests__/discoverMapMarkers.test.ts` | `bagsLeft` aggregation and `hasShelf` cases |

## Evidence (`screenshots/pass15c/`)

| File | Shows |
| --- | --- |
| `00-before-launch.png` | Baseline before changes |
| `01-map-typed-markers.png` | Four distinct typed pins (meals, cafe, supermarket, shelf+badge) framed on launch |
| `02-marker-selected-preview.png` | Selected pin scaled up + preview card slid in |
| `03-preview-opens-outlet.png` | Preview tap opens the outlet screen |
| `04-map-panned.png` | Map panned by gesture, pins persist, "Search this area" appeared |
| `05-count-chip-refit.png` | Count chip re-framed all pins |
| `06-zoomed-in.png` | Street-level zoom via rail |
| `07-zoomed-out-legible.png` | Pins legible at mid zoom |
| `08-feed-scroll-works.png` | Vertical page scroll from the feed still works |
| `pass15c-map-motion.mp4` | ~2.5 min recording: intro animation, marker drop-in, selection, pan, refit |

## Quality gates

- `npm run typecheck` — clean.
- Targeted Jest (`discoverMapMarkers`, `parseOutletCoords`): 24/24 pass.
- Full Jest: 230/230 tests pass across 44 suites. One suite (`__tests__/App.test.tsx`) fails to *parse* due to a pre-existing `@sentry/react-native` ESM transform issue — confirmed failing identically on the base commit with all changes stashed; unrelated to this work.

## Regression guard notes

- Marker data still comes only from the existing feed (no new network calls).
- Invalid/(0,0) coords still skipped via `isValidDiscoverOutletCoord`; dedupe still one marker per outlet.
- Guest sign-in empty state, feed mix, outlet location editor, and orders/impact flows untouched.

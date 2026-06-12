# Pass 15e — Discover Map Surface Styling

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15d (`3973bad` feed↔map sync + nav pill)

## Problem

Rescue Radar chrome (typed markers, preview card, control rail, count chip, pulse) was on-brand, but the **tile surface** still read as stock Apple Maps on iOS because `customMapStyle` is ignored by MapKit (`PROVIDER_DEFAULT`). Light mode on Android only had a two-rule water tweak; dark mode used generic Aubergine.

## Approach

### Provider

- Discover `MapView` now uses **`PROVIDER_GOOGLE`** on iOS and Android via `discoverMapProvider` in `src/lib/discoverMapStyle.ts`.
- iOS native: linked **`react-native-maps/Google`** subspec (GoogleMaps 9.4.0) while keeping autolinking so Fabric registers `RNMapsGoogleMapView`.
- `GMSServices.provideAPIKey` in `AppDelegate.swift`; key flows from `GOOGLE_MAPS_API_KEY` build setting → `Info.plist` `GMSApiKey`.
- Dev setup: copy `ios/Maps.local.xcconfig.example` → `ios/Maps.local.xcconfig` (gitignored) and/or set `GOOGLE_MAPS_API_KEY` in project-root `.env` (Android reads `.env` in `app/build.gradle`).

### Style JSON (`discoverMapStyle.ts`)

Two full Google Maps style arrays — always applied (light **and** dark):

| Element | Light (“Fresh parchment”) | Dark (“Night rescue”) |
| --- | --- | --- |
| Land | `#f2efe8` warm parchment | `#141412` / `#1c1b18` umber |
| Parks | `#c5ddc8` sage | `#1e3a30` forest sage |
| Water | `#6ec4cc` brand teal | `#0a4a50` deep teal |
| Roads | Warm stone hierarchy, white highways | `#2a2d30` → `#3d4a52`, teal highway stroke `#01696f` |
| Labels | `#4a4742` / highway `#004f54` | `#97e6ec` / highway `#85d3da` |
| POI business | Hidden (icons + labels) | Hidden |

POI suppression keeps rescue pins as the only food story on the surface (`showsPointsOfInterests={false}` unchanged).

### Camera / zoom

Google tiles use discrete `zoom` on iOS; `discoverMapUsesGoogleTiles` switches `mapCamera.ts` and Discover FAB zoom to zoom-based nudging (was MapKit `altitude` only).

### Unchanged (Rescue Radar)

Markers, preview card, control rail, count chip, pulse, pan/zoom, feed↔map sync, EWKB coords, guest sign-in, feed mix — no behavioral changes.

## Evidence (`screenshots/pass15e/`)

| File | Shows |
| --- | --- |
| `07-branded-map-surface.png` | Branded light map: teal water, sage parks (e.g. Viharamahadevi), parchment land, warm roads; typed rescue pins + count chip + control rail unchanged |
| `pass15c/01-map-typed-markers.png` (Pass 15c) | **Before** reference — stock Apple MapKit surface underneath same Rescue Radar chrome |

## Quality gates

- `npm run typecheck` — clean
- Jest (`discoverMapMarkers`, `parseOutletCoords`) — 24/24 pass
- iOS sim: app launches with Google SDK key; map renders (no `GMSServicesException` / no `Unimplemented RNMapsGoogleMapView` after Fabric + Google subspec fix)
- Colombo viewport: water/parks/roads clearly non-stock; markers remain legible

## Setup note for new clones

1. Add `GOOGLE_MAPS_API_KEY=` to `.env` (see `.env.example`).
2. Copy `ios/Maps.local.xcconfig.example` → `ios/Maps.local.xcconfig` with the restricted iOS Maps SDK key.
3. `cd ios && pod install` then rebuild.

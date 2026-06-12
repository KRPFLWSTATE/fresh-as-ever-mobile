# Pass 15j — Discover Map Branded Lagoon Water + Distinctive Surface

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15i bright surface (`61b573e`), Pass 15e readable baseline (`fd5dbf7`)  
Login: `qa.customer@freshasever.test`

## Problem (pass15i feedback)

User reported pass15i was **better but not enough** — map surface still lacked personality. Critically:

- **Water not visible / not branded** — pass15i `#72dce4` on `#ffffff` land washed out to near-invisible or read as generic Google `#aadaff` lagoon blue
- User explicitly wanted to get **away** from stock Google light blue; water must be **Fresh As Ever teal/deep lagoon** (`#01696f`, `#004f54`, pass15e `#6ec4cc` reference)

## Root cause — why water wasn't visible

| Factor | pass15i behaviour | Effect |
| --- | --- | --- |
| Water fill | `#72dce4` (brighter than pass15e) | ~1.3:1 contrast vs white land — reads as invisible / generic pale blue |
| Land canvas | Pure `#ffffff` | Maximum luminance reduces water contrast further |
| Water rules | Single `water` + `geometry` only, mid-array | No `geometry.fill` / stroke emphasis; rules could lose to later layers |
| Shoreline | `#01696f` at weight 1.4 | Too subtle at city zoom |
| Viewport | Galle Face ocean + Beira Lake **are** in Colombo fitToCoordinates viewport | **Not a camera issue** — styling was the blocker |

**Camera:** No DiscoverScreen change required. `frameRescuePins` on Fort/Colombo 07 markers already includes Galle Face coastline (west) and Beira Lake (north) at zoom 14.

## Approach — branded lagoon water + richer surface

**Only** `src/lib/discoverMapStyle.ts` changed. Markers, preview card, tap flow, feed, header, gestures — unchanged.

### Water (P0) — `brandedWaterStyles()` helper

| Rule | pass15i | pass15j |
| --- | --- | --- |
| Fill | `#72dce4` | **`#2a9098`** deep Stitch lagoon (between `#01696f` and pass15e `#6ec4cc`) |
| Fill targets | `water` geometry only | **`water` + `geometry.fill`** with `visibility: on` |
| Stroke | `#01696f` 1.4 | **`#004f54` 2.5** — crisp branded shoreline |
| Label fill | `#004f54` | `#d0e8e6` on water + matching text stroke |
| Array order | Mid-array (before buildings) | **Last** — wins over global geometry rule |

Branded, not generic: hue is green-teal (`#2a9098`) anchored on Stitch primaryContainer `#01696f`, not Google’s blue-shifted `#aadaff`.

### Overall surface (P1)

| Layer | pass15i | pass15j |
| --- | --- | --- |
| Base land | `#ffffff` | **`#faf9f6`** warm cream canvas |
| Parks | `#6dd4a0` | **`#52cc88`** + `#004f54` 2.0 stroke |
| Admin borders | Grey / light teal | **`#01696f` province**, `#004f54` country 2.4 |
| Highways | White + teal stroke | **`#e8f4f4` fill** + `#004f54` 2.0 / controlled-access `#d0e8e6` |
| Roads | Light grey | Warmer **`#d4dede`** base, stronger local/arterial strokes |
| Buildings | `#d0e0e0` | **`#c4d8da`** + `#01696f` 1.2 stroke — teal-tinted blocks |
| Natural landcover | — | **`#b0e4d8` / `#88d4c8`** terrain tiers for land-use differentiation |

Rescue pins unchanged — pop harder on cream land + saturated teal water.

## Unchanged (Rescue Radar)

Markers, preview card, control rail, count chip, pulse, pan/zoom, tap flow (marker → preview only → card opens outlet), feed, header, EWKB coords — **no behavioral changes**.

## Evidence (`screenshots/pass15j/`)

| File | Shows |
| --- | --- |
| `01-map-surface-colombo-water.png` | Colombo: **deep teal Galle Face ocean** (left), **Beira Lake** + **Viharamahadevi Park** green, cream land, teal road grid; rescue pins pop |
| `02-marker-tap-preview-only.png` | Marker selected; **`discover.map.preview`** card on map; feed not scrolled |
| `03-preview-opens-outlet.png` | Preview tap → **Outlet** screen (Kumbuk Colombo 07 / Active rescue bags) |
| `../pass15i/01-map-surface-colombo.png` | **Before** (pass15i — washed/invisible water) |
| `../pass15e/07-branded-map-surface.png` | **Reference** (pass15e — readable teal water baseline) |

## Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| iOS sim build + run (Xcode MCP) | ✅ |
| Appium MCP: marker tap → preview only | ✅ `discover.map.preview` found |
| Appium MCP: preview tap → outlet | ✅ Outlet + Active rescue bags |
| Branded water visible (not `#aadaff`) | ✅ deep lagoon teal in screenshot |
| Surface more distinctive than pass15i | ✅ parks, admin, highways, buildings differentiated |

## Files touched

- `src/lib/discoverMapStyle.ts` — branded lagoon water + richer surface (light + dark)
- `docs/verification/pass15-discover-map/pass15j-water-surface-report.md` (this file)
- `docs/verification/pass15-discover-map/pass15j-verify.mjs`
- `docs/verification/pass15-discover-map/screenshots/pass15j/*.png`

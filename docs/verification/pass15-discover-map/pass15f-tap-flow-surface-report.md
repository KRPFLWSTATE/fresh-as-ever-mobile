# Pass 15f — Discover Map Tap Flow + Surface Depth

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15d feed↔map sync (`3973bad`), Pass 15e Google surface (`fd5dbf7`)

## 1. Marker tap flow (P0 UX fix)

### Problem

Pass 15d restored `scrollFeedToMarker` and `feedRowMapLinked` — first pin tap scrolled the feed to the matching outlet row and outlined the card, competing with the Rescue Radar preview card.

### Change

- **`onRescueMarkerPress`** now only: light haptic, `setSelectedMarkerKey`, camera ease to pin. No second-tap shortcut to open outlet.
- **Removed** `scrollFeedToMarker` and feed `feedRowMapLinked` highlight entirely.
- **Preserved**: pin selection swell, `SelectedRescuePreview` slide-up, preview-card `onOpen` → `openRescueMarker`, map-background dismiss.

### Evidence (`screenshots/pass15f/`)

| File | Shows |
| --- | --- |
| `02-marker-tap-preview-only.jpg` | Purple hybrid pin selected; preview card "Bakehouse Kollupitiya · 1 bag left · clearance shelf live"; feed header still at "Rescue near you" (no scroll-to-row, no teal outline) |
| `03-preview-opens-outlet.jpg` | Preview card tap → full Outlet screen for Bakehouse Kollupitiya with clearance shelf listing |

## 2. Map surface depth (creative mandate)

### Problem

Pass 15e branded tiles were a good start but still read generic — flat land, thin roads, minimal land-use separation.

### Approach — "market-day parchment" (light) / "night rescue lagoon" (dark)

Expanded `discoverMapStyle.ts` from ~25 rules → **70+ rules per theme**:

| Layer | Light | Dark |
| --- | --- | --- |
| Base land | Warm parchment `#f4f0e8` | Umber `#121110` |
| Land use | `landscape.natural`, `landcover`, `terrain`, `man_made` tiers | Forest/umber splits |
| Parks | Sage fill `#a8cdb0` + stroke `#7aab86`, sports complexes | Deep forest `#163028` + edge `#1f4a3c` |
| Water | Lagoon `#5ab8c2` + shoreline stroke `#3a9aa6` | Deep teal `#083c42` + glow stroke |
| Roads | Local → arterial → highway → controlled-access hierarchy with warm stone strokes | Charcoal tiers + teal highway glow `#01696f` |
| Buildings | Massing `#ddd8cf` + footprint stroke | Silhouette `#22201c` |
| Labels | Locality teal `#004f54`, neighborhood muted, highway weighted | Teal glow `#97e6ec` / `#85d3da` |
| Admin | Country/province stroke tiers | Matching dark borders |
| POI business | Still hidden — rescue pins remain the food story |

**Complementary MapView props** (surface only): `loadingBackgroundColor` + `loadingIndicatorColor` from `discoverMapLoadingForScheme()` — parchment/teal in light, umber/teal-glow in dark.

**Unchanged**: `PROVIDER_GOOGLE`, `userInterfaceStyle` sync, Rescue Radar markers/preview/rail/chip/pulse, pan/zoom, EWKB coords, guest sign-in, feed mix.

### Evidence

| File | Shows |
| --- | --- |
| `01-map-surface-colombo.jpg` | Colombo viewport: parchment land, teal locality labels (FORT, UNION PLACE), warm road hierarchy, saturated rescue pins pop against muted surface |
| `pass15e/07-branded-map-surface.png` | **Before** reference (pass15e) |

## Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| Jest `discoverMapMarkers`, `parseOutletCoords` | ✅ 24/24 pass |
| iOS sim build + run (Xcode MCP) | ✅ |
| Appium MCP: marker tap → preview only | ✅ `discover.map.preview` found, feed not yanked |
| Appium MCP: preview tap → outlet | ✅ Bakehouse Kollupitiya outlet screen |

## Files touched

- `src/screens/DiscoverScreen.tsx` — tap flow, remove feed sync, loading chrome props
- `src/lib/discoverMapStyle.ts` — expanded JSON styles + loading palette helpers
- `docs/verification/pass15-discover-map/pass15f-tap-flow-surface-report.md` (this file)
- `docs/verification/pass15-discover-map/screenshots/pass15f/*.jpg`

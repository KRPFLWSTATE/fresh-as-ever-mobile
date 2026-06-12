# Pass 15g — Discover Map Surface Contrast & Readability

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15f tap flow (`1c75257`), Pass 15e Google surface (`fd5dbf7`)

## Problem (pass15f regression)

Pass 15f expanded the style JSON from ~25 rules to 70+ per theme but **over-muted** the canvas:

| Issue | pass15e (readable) | pass15f (washed out) |
| --- | --- | --- |
| Water | `#6ec4cc` bright lagoon | `#5ab8c2` desaturated |
| Parks | `#c5ddc8` saturated sage | `#a8cdb0` muted |
| Land layers | 2–3 distinct tones | 8+ beige tiers (`#f4f0e8`, `#ebe6dd`, `#e6e1d8`…) merging into flat greige |
| Road strokes | visible highway outline | 0.3–0.4 weight, `#d2ccc2` / `#d8d2c8` — nearly invisible on parchment |
| Labels | `#004f54` locality, no weight hack | teal locality + `{ weight: 0.5 }` on labels — tiny/low contrast on pale ground |

User feedback: pass15f/01 felt **gray and unreadable**; pass15e/07 was at least navigable. Rescue pins still popped, but streets/parks/water/labels failed the usability bar.

## Fix — "fresh rescue canvas" (light) / restored lagoon depth (dark)

**Only** `src/lib/discoverMapStyle.ts` changed (+ loading palette constants). No marker, preview, tap, feed, or gesture edits.

### Light theme adjustments

- **Hue separation restored**: land-use tiers now span warm stone (`#e8e3d8`) → sage green (`#c0d8b8` / `#b0ccb0`) instead of collapsing into beige.
- **Parks**: `#b8d8be` fill + `#6a9e74` stroke (weight 1.0) — at/above pass15e saturation with pass15f edge definition.
- **Water**: `#64c8d2` fill + `#2a98a8` shoreline stroke (0.8) — lagoon reads instantly against parchment.
- **Road hierarchy**: darker strokes (`#c4bcb0` local → `#a8a094` arterial → `#5ab0bc` controlled-access teal accent); weights 0.6–1.2.
- **Highways**: white fill retained; stroke bumped to weight 1.0 for A-road legibility.
- **Labels**: locality `#003d42`, neighborhood `#4a4540`; text stroke weight 2.5 for halo legibility; removed invalid `weight` on label fills.
- **Buildings**: `#d0cac0` + `#a8a094` stroke — subtle massing without competing with pins.

### Dark theme adjustments

- Water restored to pass15e `#0a4a50` with brighter shoreline `#0d6870`.
- Parks `#1a382e` + edge `#2a5848`; arterial/highway tiers lifted for separation.
- Label stroke weight 2.5; neighborhood/parcel fills brightened.

### Loading chrome

`DISCOVER_MAP_LOADING_LIGHT.background` → `#f0ebe3` (matches new parchment base).

## Unchanged (Rescue Radar)

Markers, preview card, control rail, count chip, pulse, pan/zoom, tap flow (marker → preview only → card opens outlet), feed, header, EWKB coords — **no behavioral changes**.

## Evidence (`screenshots/pass15g/`)

| File | Shows |
| --- | --- |
| `01-map-surface-colombo.png` | Colombo viewport: teal Galle Face water, warm road grid, dark-teal FORT/UNION PLACE labels, saturated rescue pins + count chip |
| `02-marker-tap-preview-only.png` | Purple hybrid pin selected; Bakehouse Kollupitiya preview "1 bag left · clearance shelf live"; feed header still at "Rescue near you" |
| `03-preview-opens-outlet.png` | Preview tap → Bakehouse Kollupitiya Outlet with clearance shelf |
| `pass15e/07-branded-map-surface.png` | **Before** (pass15e — readable baseline) |
| `pass15f/01-map-surface-colombo.jpg` | **Regression** (pass15f — washed out) |

## Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| iOS sim build + run (Xcode MCP) | ✅ |
| Appium MCP: marker tap → preview only | ✅ `discover.map.preview` found |
| Appium MCP: preview tap → outlet | ✅ Bakehouse Kollupitiya outlet screen |
| Rescue pins vs surface contrast | ✅ purple/brown/red pins + orange chip pop on parchment/teal canvas |

## Files touched

- `src/lib/discoverMapStyle.ts` — contrast/readability pass on light + dark JSON styles and loading palette
- `docs/verification/pass15-discover-map/pass15g-surface-contrast-report.md` (this file)
- `docs/verification/pass15-discover-map/screenshots/pass15g/*.png`

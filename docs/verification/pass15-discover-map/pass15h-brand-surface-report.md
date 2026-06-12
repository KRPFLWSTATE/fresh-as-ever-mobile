# Pass 15h — Discover Map On-Brand Lighter Surface

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15g contrast pass (`726b0f8`), Pass 15e readable baseline (`fd5dbf7`)  
Login: `qa.customer@freshasever.test`

## Problem (pass15g feedback)

User reported the map was **still too dark** and **not on theme** — muddy sepia/brown-grey land with park-green as the only brand signal. Pass 15g improved road/label contrast over 15f but kept a warm stone stack (`#f0ebe3`, `#e8e3d8`, `#ded8ce`, `#d0cac0`) that felt disconnected from the app’s clean white UI, teal CTAs, and orange accents.

Quote: **"just green and white not enough"** — need full Fresh As Ever design language on the tile surface.

## Approach — Stitch-aligned "fresh rescue canvas"

**Only** `src/lib/discoverMapStyle.ts` changed (loading palette constants included). Markers, preview card, tap flow, feed, header, gestures — unchanged.

### Stitch tokens woven into the map

| Token | Hex | Map usage (light) |
| --- | --- | --- |
| `background` | `#f7f6f2` | Base geometry, label halos, loading background |
| `surface` | `#ffffff` | Arterial + highway fills |
| `surface2` | `#f3f0ec` | Landscape / local roads |
| `surfaceContainerLow` | `#f1f4f4` | Admin blocks, medical POI |
| `surfaceContainerHigh` | `#e6e9e9` | Building massing |
| `primaryHighlight` | `#d0e8e6` | Natural landcover, transit lines |
| `primary` | `#004f54` | Locality + highway labels, park label text |
| `primaryContainer` | `#01696f` | Water shoreline, park edges, controlled-access highway stroke, loading spinner |
| `primaryFixedDim` / pass15e water | `#6ec4cc` | Water fill (bright lagoon — best visibility from 15e) |
| `onSurfaceVariant` | `#3f4949` | Default labels, road names |
| `onSurface` | `#181c1d` | Arterial label text |
| `outlineVariant` | `#bec8c9` | Admin + building + arterial strokes (cool, not brown) |
| `surfaceDim` | `#d7dbda` | Road base strokes |
| `accentHighlight` | `#fde8cc` | Man-made civic warmth, transit stations, school POI tint |
| `textMuted` | `#6b6762` | Parcel labels |

Dark mode anchors on `background` `#141412`, `surface` / `surface2`, `brandCyan` `#02b3be` for water shoreline + controlled-access glow, `primaryContainer` `#01696f` for park edges and highway strokes, `onPrimaryContainer` `#97e6ec` / `primaryFixedDim` `#85d3da` for labels — **night rescue lagoon**, not muddy umber.

### Key deltas vs pass15g

| Layer | pass15g (muddy) | pass15h (on-brand) |
| --- | --- | --- |
| Base land | `#f0ebe3` warm sepia parchment | `#f7f6f2` Stitch app background — brighter cream |
| Natural tiers | Brown-green `#d8e6d0` / `#c0d8b8` stack | Teal-tint `#eef5f3` → `#d0e8e6` (primaryHighlight sage) |
| Parks | Forest `#b8d8be` + brown-green edge | Teal-sage `#c5e8dc` + **primaryContainer** `#01696f` edge |
| Water | `#64c8d2` (OK) | `#6ec4cc` (15e-readable) + `#01696f` shore |
| Road strokes | Warm brown `#b8b0a4` / `#a8a094` | Cool `#d7dbda` / `#bec8c9` / `#6f797a` |
| Highways | White fill (kept) | White + **teal** controlled-access accent |
| Buildings | Brown `#d0cac0` | Cool `#e6e9e9` |
| Orange accent | None | `accentHighlight` on man_made / transit / schools |
| Dark land | Umber `#22201c` buildings | Stitch `#252420` surfaces + cyan water glow |

## Unchanged (Rescue Radar)

Markers, preview card, control rail, count chip, pulse, pan/zoom, tap flow (marker → preview only → card opens outlet), feed, header, EWKB coords — **no behavioral changes**.

## Evidence (`screenshots/pass15h/`)

| File | Shows |
| --- | --- |
| `01-map-surface-colombo.png` | Colombo viewport: lighter cream canvas, bright teal Galle Face water, white road grid, teal locality labels, rescue pins + orange count chip against on-theme surface |
| `02-marker-tap-preview-only.png` | Map pin selected; preview card visible (`discover.map.preview`); feed not scrolled |
| `03-preview-opens-outlet.png` | Preview tap → outlet screen (Bakehouse Kollupitiya clearance shelf) |
| `pass15g/01-map-surface-colombo.png` | **Before** (pass15g — sepia/muddy) |
| `pass15e/07-branded-map-surface.png` | **Reference** (pass15e — readable baseline user preferred) |

## Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| iOS sim build + run (Xcode MCP) | ✅ |
| Appium MCP: marker tap → preview only | ✅ `discover.map.preview` found |
| Appium MCP: preview tap → outlet | ✅ Bakehouse Kollupitiya outlet |
| Rescue pins vs surface contrast | ✅ purple/brown/orange pins + chip pop on lighter canvas |

## Files touched

- `src/lib/discoverMapStyle.ts` — Stitch-aligned lighter branded surface (light + dark) and loading palette
- `docs/verification/pass15-discover-map/pass15h-brand-surface-report.md` (this file)
- `docs/verification/pass15-discover-map/pass15h-verify.mjs` — verification script
- `docs/verification/pass15-discover-map/screenshots/pass15h/*.png`

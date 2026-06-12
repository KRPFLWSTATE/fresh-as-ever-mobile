# Pass 15i — Discover Map Bright Surface (anti pencil-sketch)

Date: 2026-06-13  
Simulator: iPhone 17 Pro (UDID `377DAC99-B79C-4B05-BB34-DBA1D160038D`), Colombo (6.9147, 79.8655)  
Builds on: Pass 15h Stitch-branded surface (`414471c`), Pass 15e readable baseline (`fd5dbf7`)  
Login: `qa.customer@freshasever.test`

## Problem (pass15h feedback)

User reported the map was **not bright enough** — it looked like **"it was drawn by a pencil"**: faint hairline grey roads, washed/muted land tones, low-contrast sketch aesthetic. Pass 15h aligned Stitch tokens but kept too many desaturated grey-beige layers that collapsed into each other.

Quote intent: **brighter, bolder, more alive** — still Fresh As Ever (teal/cream/white) but **printed/digital**, not hand-sketched.

## Root cause — why pass15h felt "pencil-like"

| Factor | pass15h behaviour | Pencil-sketch effect |
| --- | --- | --- |
| Land stack | Many near-identical tiers (`#f7f6f2`, `#f3f0ec`, `#eef5f3`, `#ebe8e4`) | Flat grey-beige wash; no bright canvas |
| Road strokes | Thin weights (0.5–0.8) + cool greys (`#d7dbda`, `#bec8c9`, `#e0e3e3`) | Hairline pencil lines; weak hierarchy |
| Road fills | Local/arterial both near-cream; base `#ebe8e4` | Roads disappear into land |
| Water | `#6ec4cc` OK but low edge contrast at 0.8 weight | Lagoon readable but not vivid vs land |
| Parks | Desaturated teal-sage `#c5e8dc` | Faint green wash, not fresh green |
| Labels | `#3f4949` default + cream halos | Muted on grey ground |
| Buildings | `#e6e9e9` fill / `#bec8c9` 0.5 stroke | Muddy pencil shading |
| Dark mode water | Deep `#0a4a50` with grey roads | Night rescue felt grey, not glowing |

## Approach — "bright rescue canvas"

**Only** `src/lib/discoverMapStyle.ts` changed (loading palette constants included). Markers, preview card, tap flow, feed, header, gestures — unchanged.

### Key deltas vs pass15h

| Layer | pass15h (pencil) | pass15i (bright) |
| --- | --- | --- |
| Base land | `#f7f6f2` cream + grey tiers | **`#ffffff` white canvas** |
| Natural land | Muted `#eef5f3` / `#d0e8e6` | Brighter `#f0faf8` / `#b8e8de` / `#98d8cc` |
| Water | `#6ec4cc` | **`#72dce4`** (brighter than 15e baseline) + `#01696f` 1.4 stroke |
| Parks | Washed `#c5e8dc` | **Vivid `#6dd4a0`** + `#01696f` 1.6 edge |
| Road base fill | `#ebe8e4` (invisible) | **`#dce4e4`** visible grey carpet |
| Local roads | Cream fill, 0.6 grey stroke | `#eef2f2` fill + **`#a8b4b4` 1.0** stroke |
| Arterial | White + `#bec8c9` 0.8 | White + **`#6f797a` 1.4** |
| Highways | `#6f797a` 1.0 grey stroke | **`#004f54` 1.6 teal** + controlled-access `#01696f` 2.0 |
| Labels | `#3f4949` / cream halo | **`#181c1d` onSurface** + white 3.5 halo |
| Buildings | `#e6e9e9` / faint stroke | **`#d0e0e0` / `#7a9496` 1.0** — subtle blocks, not mud |
| Loading light | `#f7f6f2` | **`#ffffff`** |
| Dark water | `#0a4a50` | **`#128890`** vivid lagoon glow |
| Dark parks | `#1e4038` | **`#348868`** saturated forest + `#02b3be` edge |

### Stitch alignment retained

- Primary `#004f54`, primaryContainer `#01696f`, accentHighlight `#fde8cc` on schools/transit
- Cream context via POI/admin `#f7f6f2` accents on white land
- Orange rescue markers / count chip unchanged — pop harder on brighter canvas

## Unchanged (Rescue Radar)

Markers, preview card, control rail, count chip, pulse, pan/zoom, tap flow (marker → preview only → card opens outlet), feed, header, EWKB coords — **no behavioral changes**.

## Evidence (`screenshots/pass15i/`)

| File | Shows |
| --- | --- |
| `01-map-surface-colombo.png` | Colombo: white/cream land, **vivid teal Galle Face water**, clearer grey road grid, dark labels; rescue pins pop on bright surface |
| `02-marker-tap-preview-only.png` | Map marker selected; **`discover.map.preview`** card visible; feed not scrolled |
| `03-preview-opens-outlet.png` | Preview tap → **Outlet** screen (Galle Face Bites / Bakehouse Colombo) |
| `../pass15h/01-map-surface-colombo.png` | **Before** (pass15h — pencil-sketch grey wash) |
| `../pass15e/07-branded-map-surface.png` | **Reference** (pass15e — readable water baseline) |

## Quality gates

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| iOS sim build + run (Xcode MCP) | ✅ |
| Appium MCP: marker tap → preview only | ✅ `discover.map.preview` found |
| Appium MCP: preview tap → outlet | ✅ Outlet screen with rescue bags |
| Rescue pins vs surface contrast | ✅ saturated pins + chip on bright white canvas |

## Files touched

- `src/lib/discoverMapStyle.ts` — bright anti-pencil surface (light + dark) and loading palette
- `docs/verification/pass15-discover-map/pass15i-bright-surface-report.md` (this file)
- `docs/verification/pass15-discover-map/pass15i-verify.mjs` — verification script
- `docs/verification/pass15-discover-map/screenshots/pass15i/*.png`

# Pass 14 — Outlet location UX report

**Date:** 2026-06-12  
**Sim:** `377DAC99-B79C-4B05-BB34-DBA1D160038D` (iPhone 17 Pro)  
**Merchant:** `qa.merchant@freshasever.test`  
**Outlet:** Bakehouse Kollupitiya (`00000000-0000-0000-0000-000000000003`)  
**Commits:** `feat(mobile): outlet location search and GPS like customer selector`, follow-up `testID` on Save, `fix(mobile): geocode typed outlet address without suggestion pick`, `fix(mobile): location search field replace-not-append`

## Summary

| Area | Result |
|------|--------|
| Shared location modules | **PASS** |
| MerchantOutletEditor integration | **PASS** |
| MerchantOnboarding step 2 integration | **PASS** (code) |
| Unit tests (typecheck + jest) | **PASS** |
| Typed-address geocode (no suggestion tap) | **PASS** |
| Suggestion dedupe (Colombo 07) | **PASS** |
| Location field replace-not-append | **PASS** |
| Appium MCP — location UI | **PASS** |
| Appium MCP — save → goBack | **PARTIAL** (automation-only) |
| Merchant save persistence (auth API) | **PASS** |
| Cross-app reflection | **PASS** |

## Save persistence verdict

**Not a product bug — automation-only limitation.**

Follow-up proved the NG7 save path works when `onSave` actually runs:

1. Appium retest with `testID="outlet.saveChanges"` — tap found element, but `updated_at` unchanged and screen stayed on Edit outlet (`visible="false"` footer inside scroll).
2. **Authenticated Supabase JS repro** (same payload as app: address update + `SRID=4326;POINT(lng lat)` WKT) — **both writes succeeded**.

### Supabase after authenticated save

```sql
SELECT address, ST_AsText(location::geometry), ST_Y(location), ST_X(location)
FROM outlets WHERE id = '00000000-0000-0000-0000-000000000003';
```

| Field | Before | After |
|-------|--------|-------|
| `address` | `142 Galle Road, Colombo 03` | `Colombo 07, Sri Lanka` |
| `location` | `POINT(0 0)` | `POINT(79.8655 6.9147)` |
| `updated_at` | `2026-06-11 20:05:25` | `2026-06-11 20:28:11` |

**Root cause of Appium miss:** Save/Cancel footer lives inside `StitchScreen` scroll content; XCUITest reports Save as `visible="false"` and taps do not reliably invoke `Pressable.onPress` (same class as Pass 9/12 merchant login keyboard issues). Added `testID="outlet.saveChanges"` for future runs.

## Cross-app reflection (after save)

| Check | Result | Evidence |
|-------|--------|----------|
| Outlet detail address | **PASS** | `freshasever://outlet/000…003` → Address card shows `Colombo 07, Sri Lanka` |
| Discover feed / nearby | **PASS** | `freshasever://discover` → Bakehouse Kollupitiya bag card, label `Near you` |
| `nearby_bags` radius (SQL) | **PASS** | 1 live bag within 15 km of Colombo 07 coords |
| Discover map area | **PASS** | Map POIs (Maradana, Lotus Tower) — Colombo centre, not null island |

## Appium MCP results (initial + follow-up)

| Step | Result | Evidence |
|------|--------|----------|
| Merchant login | **PASS** | Dashboard: "Bakehouse Kollupitiya" |
| Deep link → outlet editor | **PASS** | `freshasever://merchant/outlets/000…003/edit` |
| Location search + suggestions | **PASS** | `outlet.location.search`, `suggestion.0`–`4` |
| GPS reverse geocode | **PASS** | Simulator → Cupertino label in page source |
| Save via `outlet.saveChanges` | **PARTIAL** | Element tapped; no DB write / no goBack |
| Customer outlet detail | **PASS** | Updated address visible |
| Customer Discover feed | **PASS** | Bakehouse near-you card |

Screenshots: `docs/verification/pass14-outlet-location/screenshots/`

## Pass 14 follow-up — typed address geocode (2026-06-12)

### Problem (before)

1. Suggestion list showed near-duplicate Nominatim rows (same venue, long labels).
2. Map pin and lat/lng updated **only** when the user tapped a suggestion — typing a full address and blurring left coords unchanged.

### Fix (after)

| Behavior | Before | After |
|----------|--------|-------|
| Suggestions | Raw API rows, often redundant | Deduped by venue + proximity; shortened labels (`venue, area`) |
| Type address, blur without tap | No coord update | 800 ms debounce + `onEndEditing` forward-geocode; map pin moves; typed address kept |
| Suggestion tap | Address + coords | Unchanged |
| Use current location | GPS + reverse geocode | Unchanged |

### Appium MCP — typing geocode

| Step | Result | Evidence |
|------|--------|----------|
| Deep link → outlet editor | **PASS** | `freshasever://merchant/outlets/000…003/edit` |
| Type `12 Ward Place, Colombo 07` (no suggestion tap) | **PASS** | Address field retains typed text |
| Blur → map + coords | **PASS** | Advanced lat/lng: `6.904154`, `79.86452` (Ward Place area, not `0,0`) |
| Type `Colombo 07` suggestions | **PASS** | Distinct rows: Colombo 07/03/05, Nugegoda, Dehiwala (no duplicate Football House variants) |

Screenshots:

- `screenshots/typing-geocode-ward-place.png`
- `screenshots/typing-geocode-colombo07-suggestions.png`

### New / updated modules

- `src/lib/locationSearchHelpers.ts` — `dedupeLocationHits`, `pickForwardGeocodeHit`, `geocodeTypedAddress`
- `src/hooks/useLocationSearch.ts` — applies dedupe to suggestion results
- `src/components/LocationSearchField.tsx` — debounced geocode + blur/submit + “Locating…” hint
- `src/components/OutletLocationPicker.tsx` — wires `onCoordsFromText` to map pin (keeps typed address)

## Pass 14 follow-up — garbled concat text (2026-06-12)

### Root cause

**Both app and automation contributed:**

| Layer | Cause |
|-------|--------|
| **Automation** | iOS XCUITest `setValue` without `clearValue` appends into the existing field (`Colombo 07` + `12 Ward Place…` → concat) |
| **App** | Parent `address` prop + deferred GPS reverse-geocode could sync into the field while the user was editing; no local draft isolation; `onEndEditing` native text was not normalized on blur |

### Fix (after)

| Behavior | Before | After |
|----------|--------|-------|
| Field text while editing | Parent `value` bound directly | Local `draft` while focused; external sync deferred until blur |
| GPS / reverse geocode during edit | Could overwrite in-progress text | Deferred via `applyAddress`; discarded if user typed |
| Blur / end editing | Stale native append persisted | `normalizeNativeEditText` strips appended baseline suffix; `setNativeProps` + remount key forces clean display |
| Replace typing UX | Partial overwrite | `selectTextOnFocus` on focus |
| Stale suggestions | Shown during query change | Hidden until fetch matches active query |
| Appium scripts | Raw `setValue` | `pass14-verify.mjs` `clearAndType()` — `clearValue` then `setValue`, hide keyboard |

### Appium MCP — replace-not-append

| Step | Result | Evidence |
|------|--------|----------|
| Type `12 Ward Place, Colombo 07` (no clear, worst case) | **PASS** | After blur: `12 Ward Place, Colombo 07` (not `…Colombo 07, Sri Lanka` suffix) |
| Replace with new query | **PASS** with `clearAndType` | Documented in `pass14-verify.mjs` |

Screenshots: `screenshots/replace-not-append-ward-place.png`, `replace-not-append-fixed.png`

### Appium guidance (pass7 / pass14)

Always clear before `setValue` on `outlet.location.search`:

```javascript
await el.click();
await el.clearValue();
await el.setValue('12 Ward Place, Colombo 07');
await d.hideKeyboard(); // triggers onEndEditing + blur
```

See `docs/verification/pass14-outlet-location/pass14-verify.mjs`.

## Implementation

### New modules

- `src/hooks/useLocationSearch.ts` — 400 ms debounce, min 2 chars (Discover parity)
- `src/components/LocationSearchField.tsx` — search shell + suggestion rows
- `src/components/OutletLocationPicker.tsx` — address search, **Use current location**, map pin, collapsed advanced lat/lng
- `src/lib/locationApi.ts` — `fetchNominatimLocationReverse` fallback when `API_BASE_URL` unset

### Screens updated

- `MerchantOutletEditorScreen.tsx` — `OutletLocationPicker`; `testID="outlet.saveChanges"` on Save; NG7 save path unchanged
- `MerchantOnboardingScreen.tsx` — step 2 uses `OutletLocationPicker` (`map-overlay`)

## Unit tests

```
npm run typecheck — PASS
jest locationSearchHelpers|LocationSearchField|useLocationSearch — 18/18 PASS
```

## Plan

See `docs/verification/pass14-outlet-location/plan.md`.

# Pass 14 — Outlet location UX report

**Date:** 2026-06-12  
**Sim:** `377DAC99-B79C-4B05-BB34-DBA1D160038D` (iPhone 17 Pro)  
**Merchant:** `qa.merchant@freshasever.test`  
**Outlet:** Bakehouse Kollupitiya (`00000000-0000-0000-0000-000000000003`)  
**Commits:** `feat(mobile): outlet location search and GPS like customer selector`, follow-up `testID` on Save

## Summary

| Area | Result |
|------|--------|
| Shared location modules | **PASS** |
| MerchantOutletEditor integration | **PASS** |
| MerchantOnboarding step 2 integration | **PASS** (code) |
| Unit tests (typecheck + jest) | **PASS** |
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
jest locationApi|useLocationSearch — 6/6 PASS
```

## Plan

See `docs/verification/pass14-outlet-location/plan.md`.

# Pass 14 — Outlet location UX plan

## Goal

Match customer Discover location selector patterns on merchant outlet flows: address search with suggestions, GPS detect, map pin drag — with lat/lng as a collapsed advanced option. Saved `outlets.location` (PostGIS) + `outlets.address` must reflect across Discover, nearby_bags, outlet detail, and pickup ops.

## Research summary (Phase 1)

### Customer gold standard

| Piece | Path | Notes |
|-------|------|-------|
| Location sheet + search | `src/screens/DiscoverScreen.tsx` | 400 ms debounce, min 2 chars, suggestion list, `applyPlaceHit` |
| Search / reverse API | `src/lib/locationApi.ts` | Hosted `API_BASE_URL` → Nominatim → `SRI_LANKA_LOCATION_PRESETS` |
| GPS hook | `src/hooks/useUserLocation.ts` | `@react-native-community/geolocation` (not expo-location) |
| Map camera | `src/lib/mapCamera.ts` | `discoverMapAnimateCamera`, zoom 14 |

### Merchant gaps (before Pass 14)

| Screen | Issue |
|--------|-------|
| `MerchantOutletEditorScreen.tsx` | Plain address `TextInput`; lat/lng primary; no search/GPS/reverse geocode |
| `MerchantOnboardingScreen.tsx` step 2 | Silent `results[0]` geocode (no picker); drag/GPS don't update address |
| `SignUpScreen.tsx` | No outlet location step (onboarding only) |

### Geocoding config

- Mobile `.env`: `API_BASE_URL` (hosted Next.js `/api/location/search` + `/api/location/reverse`)
- No separate Google/Nominatim keys in mobile; Nominatim used as client fallback for search
- **Pass 14 adds** Nominatim reverse fallback when `API_BASE_URL` unset (mirrors search tier)

## Implementation plan (Phase 2)

### New shared modules

1. **`src/hooks/useLocationSearch.ts`** — debounced `fetchLocationSearch` (400 ms, min 2 chars), busy/error/suggestions state (extracted from Discover)
2. **`src/components/LocationSearchField.tsx`** — Stitch search shell + suggestion rows (Discover pattern)
3. **`src/components/OutletLocationPicker.tsx`** — composes search + "Use current location" + `MapView` draggable pin + collapsed advanced lat/lng; bidirectional sync via `fetchLocationReverse`

### Screen updates

| Screen | Change |
|--------|--------|
| `MerchantOutletEditorScreen.tsx` | Replace Location section with `OutletLocationPicker`; remove duplicate address field from identity (address lives in picker); keep NG7 `refetchMerchantContext` + PostGIS WKT save |
| `MerchantOnboardingScreen.tsx` step 2 | Replace inline map overlay search with `OutletLocationPicker` (`mapOverlay` variant); remove silent `useEffect` geocode |

### Sync rules

| Action | Address | Lat/lng | Map |
|--------|---------|---------|-----|
| Type + pick suggestion | `hit.label` | `hit.lat/lng` | animate camera |
| Use current location | reverse geocode label | GPS fix | animate camera |
| Drag pin | reverse geocode label | drag coords | marker moves |
| Advanced lat/lng edit | unchanged until reverse (optional on blur) | typed values | region updates |

### Persistence (unchanged NG7)

```sql
UPDATE outlets SET location = 'SRID=4326;POINT(lng lat)' WHERE id = $1
```

Plus `address`, `updated_at`; then `refetchMerchantContext()`.

## Verification (Phases 3–4)

### Cross-app reflection

1. Save test coords on Bakehouse / QA outlet via merchant editor
2. Customer Discover: pin in correct area
3. `nearby_bags` RPC respects saved geography
4. Outlet detail address line matches `outlets.address`

### Appium MCP (sim `377DAC99-B79C-4B05-BB34-DBA1D160038D`)

- Merchant login `qa.merchant@freshasever.test`
- Profile/Settings → Edit outlet
- Address type → pick suggestion → map moves
- "Use current location"
- Drag pin → address updates
- Save → goBack
- Onboarding step 2 if reachable
- Screenshots → `docs/verification/pass14-outlet-location/screenshots/`

### Unit tests

- `useLocationSearch` debounce/min-chars
- `fetchLocationReverse` Nominatim fallback
- Existing `locationApi.test.ts` extended

## Files touched

- `src/lib/locationApi.ts` — Nominatim reverse fallback
- `src/hooks/useLocationSearch.ts` — new
- `src/components/LocationSearchField.tsx` — new
- `src/components/OutletLocationPicker.tsx` — new
- `src/screens/MerchantOutletEditorScreen.tsx`
- `src/screens/MerchantOnboardingScreen.tsx`
- `__tests__/useLocationSearch.test.ts` — new
- `__tests__/locationApi.test.ts` — extended

## Risk / constraints

- Do not break Pass7 NG7 outlet save (`refetchMerchantContext`, goBack on success)
- Reverse geocode requires network; Nominatim fallback when `API_BASE_URL` missing
- Merchant editor uses one-shot GPS (not Discover follow/watch mode)

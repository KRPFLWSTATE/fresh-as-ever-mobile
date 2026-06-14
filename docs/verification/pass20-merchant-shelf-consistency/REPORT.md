# Pass 20 — Merchant shelf consistency report

**Date:** 2026-06-14  
**Outlet:** Bakehouse Kollupitiya (`00000000-0000-0000-0000-000000000003`)  
**Supabase project:** `odkbpeelvcdmlimdflbr`

## Executive summary

Merchant **Shelves** showed **NOT STARTED** while **Orders** listed paid shelf order `#SHELF1` because demo infrastructure slid `pickup_start` / `pickup_end` forward without rolling `shelf_date` to UTC today. Mobile correctly keys “Today’s shelf” off `shelf_date === today (UTC)` — the data was inconsistent, not the UI rule.

## Root cause

| Layer | Finding |
|-------|---------|
| **Data** | Canonical demo shelf `…0201` had `shelf_date = 2026-06-03` but `pickup_start/end` on `2026-06-14` after cron refresh |
| **Order** | `#SHELF1` (`…0040`) references shelf `…0201`; orders read pickup from shelf join → visible in Orders |
| **UI** | `useMerchantShelves` sets `todayShelf` when `shelf_date === new Date().toISOString().slice(0,10)` → no row for 2026-06-14 → **Not started** |
| **Infra** | `refresh_demo_clearance_shelf_pickup_windows()` updated **all** `seed_demo` rows; `_ensure_outlet_demo_listings_core` `ON CONFLICT (id)` did not set `shelf_date` when re-upserting stable id `…0201` |

### Supabase evidence (before fix)

```sql
-- UTC / Colombo today = 2026-06-14; no shelf dated today
SELECT id, shelf_date, status, pickup_start, pickup_end, seed_demo
FROM clearance_shelves
WHERE outlet_id = '00000000-0000-0000-0000-000000000003'
ORDER BY shelf_date DESC;
```

| id | shelf_date | status | pickup_end (UTC) | seed_demo |
|----|------------|--------|------------------|-----------|
| …0201 | **2026-06-03** | published | 2026-06-14 23:28 | true |
| 64ca6314… | 2026-06-12 | published | 2026-06-13 23:29 | true |

```sql
SELECT reservation_code, shelf_id, order_status, cs.shelf_date
FROM orders o
JOIN clearance_shelves cs ON cs.id = o.shelf_id
WHERE o.reservation_code = 'SHELF1';
```

→ `SHELF1` → shelf `…0201`, `shelf_date = 2026-06-03`, `order_status = paid`.

## Fixes

### Supabase (`20260614150000_fix_demo_shelf_date_drift.sql`)

1. `refresh_demo_clearance_shelf_pickup_windows` — roll canonical shelf `…0201` `shelf_date` to UTC today; only slide windows for demo shelves **dated today**.
2. `_ensure_outlet_demo_listings_core` — resolve canonical shelf by id when no today row; always set `shelf_date = v_today` on upsert/update; include `shelf_date` in `ON CONFLICT`.
3. One-time repair: roll `…0201` forward; close stray duplicate demo shelf `64ca6314…` (no active orders).

### Mobile

| File | Change |
|------|--------|
| `src/domain/pickupWindow.ts` | Shared `formatMerchantPickupWindow`, `formatLatenessLabel`; cross-midnight day labels in `formatPickupLine` |
| `src/screens/MerchantOrdersScreen.tsx` | Use shared formatters; late badge human labels (`13h 1m late`); layout flex fixes on late card header |
| `src/screens/MerchantOrderDetailScreen.tsx` | Use shared `formatMerchantPickupWindow` |
| `__tests__/pickupWindow.test.ts` | Coverage for overnight windows + lateness labels |

Bags flow untouched.

## Late pickups & time display

| Issue | Cause | Fix |
|-------|-------|-----|
| `781M LATE` on Cafe Savory Mix | `781` minutes shown as `${mins}m LATE` with `label-caps` → **781M** | `formatLatenessLabel(781)` → `13h 1m late`, regular `label` variant |
| `Today 15:58 - 04:58` | Overnight bag window (Kumbuk: end 02:00 UTC next day); end time on next calendar day | `formatMerchantPickupWindow` adds end day: `Today, 22:30 – Tomorrow, 07:30` (local) |

SQL late order example: Kumbuk `Cafe Savory Mix`, `mins_past_end ≈ 912` (~15h).

## Verification queries (after migration)

```sql
SELECT id, shelf_date, status, pickup_start, pickup_end
FROM clearance_shelves
WHERE id = '00000000-0000-0000-0000-000000000201';

SELECT reservation_code, cs.shelf_date, cs.status
FROM orders o
JOIN clearance_shelves cs ON cs.id = o.shelf_id
WHERE o.reservation_code = 'SHELF1';
```

Expected: `shelf_date = current UTC date`, status `published`, SHELF1 shelf_date matches today.

## Related deliverables

- Manual test guide: `docs/verification/pass19-features/MANUAL-TEST-GUIDE-KAWIN.md`

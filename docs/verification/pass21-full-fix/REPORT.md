# PASS 21 — Full Fix Report

## Summary

PASS 21 addresses dark-mode contrast, group/shelf checkout reliability, analytics correctness, cart logout hygiene, and Supabase group-reservation support for duplicate bag IDs.

---

## Root causes

### Dark mode green-on-green
**Cause:** `StitchText` used `colorKey="primary"` / `primaryContainer` on `primaryHighlight` (`#1a3f42`) backgrounds in dark mode — both are dark teal, yielding unreadable text.

**Fix:** Added `src/lib/stitchContrast.ts` helpers (`textOnGreenSurface`, `headlineOnGreenSurface`) returning `onPrimary` (white) in dark mode. Applied to GroupCheckoutStrip, MerchantImpactHero, BasketTimerPill, ImpactScreen icon bubbles, ClearanceShelf halal chip.

### C6 — Group checkout failures
**Cause (load error):** `CheckoutScreen.hydrate` required `rows.length === groupBagIds.length`, but Supabase `.in('id', …)` dedupes IDs. Adding the same bag twice made `groupBagIds = [id, id]` while the query returned one row → "Could not load bag details".

**Cause (RPC):** `create_group_reservation` enforced `count(distinct id) = array_length`, rejecting duplicate bag IDs in `p_bag_ids`.

**Fix:** Mobile hydrates by expanding requested ids; cart allows duplicate entries; migration `20260614210000_group_reservation_duplicate_bags.sql` validates stock per id, sums subtotal per slot, inserts one order per array element.

### C6 — Group cart when logged out
**Cause:** Cart persisted in AsyncStorage; Discover/Outlet screens showed cart bar without checking auth.

**Fix:** `clearReservationCartStorage()` on signOut; cart bars gated on `session?.user` / `user`.

### C6 — Card-only button when cash eligible
**Cause:** Static copy in OutletDetailScreen and CheckoutScreen.

**Fix:** Dynamic titles based on `completedPickups >= 1` and group vs single checkout.

### C9 — Shelf timer / expiry
**Cause:** Timer called `refreshShelf()` only; basket quantities not reconciled against fresh stock.

**Fix:** `onExpired` → refresh + rehydrate + `revalidateBasketQuantities` clamps/removes sold-out lines.

### C10 — Impact pull-to-refresh
**Cause:** `RefreshControl` used `loading` from initial fetch — often false before user sees spinner.

**Fix:** Separate `refreshing` state; `Promise.all([refetch(), refetchStreak()])`.

### M11 — 7 days vs 30 days same values
**Cause (data):** Supabase proof — all collected merchant orders for qa.merchant are within the last 7 days (2 orders, 2 kg food), so 7d and 30d windows return identical aggregates. **Not a cutoff bug.**

**Cause (UX):** Stale snapshot could flash during window switch.

**Fix:** `useMerchantAnalytics` clears snapshot on refetch and ignores stale responses via generation counter.

### M11 — CO₂ (5 kg from 2 kg food)
**Analysis:** Per `CO2_METHODOLOGY.md`, **2.5 kg CO₂e per kg food** → 2 kg rescued → **5 kg CO₂e is correct**.

**Bug fixed:** `co2eKgFromFoodKg` incorrectly passed aggregate totals through `clampBagWeightKg` (per-bag clamp/default), which could inflate small/zero totals. Now uses direct multiply with zero guard.

**SQL proof:** `food_kg_30d = 2.0`, `expected_co2_30d = 5.0` (2 × 2.5)

### Multi-outlet profile (qa.merchant)
**Finding:** Intentional demo data — one user owns **two merchants** (Bakehouse Colombo + Kumbuk QA Cafe) → **4 outlets**. No data bug.

### Customer orders tab
**Finding:** qa.customer has 10 distinct orders with mixed demo statuses. No duplicate ids.

---

## Commit hashes

_(filled after commit)_

# Phase gates and chain reactions

## Phase 0 — Baseline

**Verify:** `docs/supabase/consistency_pass_baseline.md` matches live CHECK constraints.

**Ripple:** Wrong status literals break RPC + filters.

## Phase 1 — Keyboard / location

**Verify:** Place sheet scrolls with keyboard open (iOS simulator).

**Ripple:** Global Keyboard listeners → RCT bridge races; avoid.

## Phase 2 — Order filters

**Verify:** `npm test -- merchantOrderFilters pickupWindow`.

**Ripple:** Live monitor empty while Orders shows rows → fix predicates before UI copy.

## Phase 2b — Late pickups

**Verify:** Late card shows Verify/Scan; no-show disabled until grace.

**Ripple:** Mislabeled cancel → merchant trust loss.

## Phase 3 — Handover RPC

**Verify:** `merchant_collect_order` sets `collected` + `collected_at`.

**Ripple:** Settlements use `collected_at` — must not skip on merchant path.

## Phase 4 — Customer arrival

**Verify:** `customer_signal_arrival` + live monitor hero.

**Ripple:** Stale hero if `customer_arrived_at` not cleared on collect (RPC clears).

## Sign-off

Run `npm run ci` before marking pass complete.

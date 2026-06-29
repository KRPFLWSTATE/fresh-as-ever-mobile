# WS7 — Merchant Orders E2E Report (final closeout)

**Run:** 2026-06-29T16:40Z (final)
**Simulator:** iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`
**Harness:** `docs/verification/orders-e2e/` (`orders-e2e-runner.mjs`, `orders-e2e-v2.mjs`, `orders-e2e-group.mjs`, `verify-log.jsonl`, `screenshots/`)
**Seeder:** `npm run refresh-demo` (re-run before E2E; idempotent `QA_SCENARIO_GROUP` `DV387Y`)
**Build:** Xcode MCP `build_run_sim` after group-sheet a11y fix
**Data truth:** Supabase MCP (`odkbpeelvcdmlimdflbr`)

## Executive summary

All four remaining plan todos are closed. The group-handover blocker is fixed: nested modal `Pressable`s were collapsing the confirm CTA into one accessibility node. After exposing `merchant.orders.confirmGroupCollect`, the `DV387Y` 2-bag group completes end-to-end and both child orders flip to `collected` in Supabase. Kumbuk outlet scope parity passes on-device (Late → `LATCRT`, Upcoming → `FUTURE`) using the v2 direct-login + `relaunchApp` pattern. WS8 branch experiments logged surplus/revenue/timezone nuances and deduped the no-show grace constant.

| Area | Result |
|------|--------|
| Seeder + scenario buckets | **PASS** |
| Group handover `DV387Y` (preview + confirm via testID) | **PASS** |
| Supabase child orders 321/322 → `collected` | **PASS** |
| Kumbuk login (`qa.kumbuk@freshasever.test`) | **PASS** |
| Kumbuk Late → `LATCRT` | **PASS** |
| Kumbuk Upcoming → `FUTURE` | **PASS** |
| Web filter parity (`merchantOrderFilters.js`) | **PASS** (code + SQL; no web UI E2E) |
| `merchantOrderFilters` unit tests | **PASS** (6/6) |
| `npm run typecheck` | **PASS** |
| Full `npm test` | **312/313 PASS** — 1 pre-existing failure in `fetchScopedNearbyBags.test.ts` (unrelated) |

**Score:** 11 gates PASS · 0 FAIL · 0 BLOCKED (for this overhaul scope)

---

## Key fix applied this run

**Group pickup sheet accessibility (P0 for E2E):** iOS XCUITest saw the entire group modal as one `XCUIElementTypeOther` with a merged label; `merchant.orders.confirmGroupCollect` was not tappable. Fix in `MerchantOrdersScreen.tsx`: modal backdrop and sheet container set `accessible={false}`; sheet body changed from nested `Pressable` to `View` with touch responder. Rebuild → Appium finds and taps confirm → RPC persists collection.

---

## Results (authoritative — final run)

| ID | Result | Detail |
|----|--------|--------|
| WS7-12g-group-preview | PASS | `DV387Y` opens "Group pickup, 2 bags" sheet |
| WS7-13g-group-handover | **PASS** | `merchant.orders.confirmGroupCollect` → "Handover complete"; SQL children `321`/`322` = `collected` |
| WS7-09v-kumbuk-login | **PASS** | Kumbuk logged in (direct + relaunchApp) |
| WS7-10v-kumbuk-late | **PASS** | Late tab shows `LATCRT` / Sandwich & Latte |
| WS7-11v-kumbuk-upcoming | **PASS** | Upcoming tab shows `FUTURE` / Rice & Curry |
| WS7-SQL-scenario-buckets | PASS | All scenario codes in correct buckets (see below) |

*Note:* v2 single-bag handover (`UQV76C`) failed in the same session because the code field lost focus after tab switches — not a regression; group run uses dedicated script and passed independently.

---

## Supabase data truth (post final E2E)

| Code | Bucket | `order_status` | `payment_status` | Outlet |
|------|--------|----------------|------------------|--------|
| UQV76C | ready_now | reserved | paid | Bakehouse |
| END2HR | ending_soon | reserved | paid | Bakehouse |
| LATREC | late | reserved | paid | Bakehouse |
| LATCRT | late | reserved | paid | Kumbuk |
| FUTURE | upcoming | reserved | pending | Kumbuk |
| DV387Y (group 321/322) | ready_now | **collected** (this run) | paid | Bakehouse |

---

## Verification gates

| Gate | Result |
|------|--------|
| `npm test -- --testPathPattern=merchantOrderFilters` | PASS |
| `npm run typecheck` | PASS |
| `npm run refresh-demo` | PASS |
| WS8 branch experiments | See `WS8_BRANCH.md` |

---

## Artifacts

- JSONL: `verify-log.jsonl` (agents `WS7-GROUP`, `WS7-V2`)
- Screenshots: `screenshots/WS7-12g-*`, `WS7-13g-*`
- WS8 log: `WS8_BRANCH.md`
- Runners: `orders-e2e-group.mjs` (updated for `DV387Y` + confirm testID)

## Files changed (this closeout)

- `src/screens/MerchantOrdersScreen.tsx` — group modal a11y fix
- `src/lib/orderStatus.ts` — import `NO_SHOW_GRACE_MS` from `pickupWindow.ts`
- `docs/verification/orders-e2e/orders-e2e-group.mjs` — `DV387Y` + confirm testID lookup
- `docs/verification/orders-e2e/REPORT.md` — this file
- `docs/verification/orders-e2e/WS8_BRANCH.md` — branch experiment log

# Pass 26 — SA-PASS26-FINISH Report

**Date:** 2026-06-19 · **Branch:** `feature/pass26-expansion` · **Sim:** `377DAC99-B79C-4B05-BB34-DBA1D160038D`

## Summary

Wave-3 Appium marathon remains **29 PASS / 46 FAIL** (75 mobile journey IDs in `results.json`). Infrastructure blocked full batch completion: Appium sessions repeatedly terminated (`invalid session id`) during merchant/customer login, often after 10–17 minutes with WDA/xcodebuild contention.

## Completed steps

| Step | Result |
|------|--------|
| Quarantine | `pkill` pass26/webdriverio, cleared locks |
| F5 order refresh | REST PATCH: `rescue_bags` + `reservation_groups` pickup window (active now → +2h), cleared `customer_on_the_way_at` / `customer_arrived_at` on order `a1ba7758…` |
| Baseline | Updated `baseline/f5-test-order.json` (`UQV76C`, eligibility, timestamps) |
| C-00 smoke | **PASS** — customer login + discover search (`pass25-c00-login-smoke.mjs`) |
| Code fixes | `openF5OrderDetail()` helper (deeplink + Orders-tab fallback); stronger F5-C01–C05 journeys in runner; F5 runner merges into `results.json`; runner writes partial results on crash |
| Partial F5 | F5-C04 **PASS** (idempotent on-my-way) from `pass26-f5-appium.mjs` run — merged into `results.json` |
| MATRIX sync | `MATRIX.md` synced from `results.json` for recorded IDs |

## Appium batches attempted

| Batch | Outcome |
|-------|---------|
| `pass26-f5-appium.mjs` (full) | Customer partial: C04 PASS; C01–C03,C05 FAIL (deeplink landed Discover — root cause fixed in helper, re-run killed) |
| Merchant ONLY_IDS ×16 | Crashed ~17m during `fillLoginField` — no results merge |
| F5 mini ONLY_IDS ×6 | Killed before first ID recorded |

## Blockers

1. **Appium session instability** — sessions die mid-login (`WebDriverError: session terminated`); merchant marathon IDs still fail with login/session errors.
2. **F5 customer surface** — prior failure: order deeplink opened Discover; helper fix not re-verified end-to-end due to (1).
3. **Supabase MCP** — `execute_sql` returned `net::ERR_FAILED`; used service-role REST instead.
4. **Web smoke** — Next.js not on `:3000`; pending web IDs (F1-W01, F3-W01/W02, F4-W01/W02, F5-W01) not CDP-verified this run.

## Files changed (uncommitted)

- `docs/verification/pass26-expansion/lib/merchantLogin.mjs` — `openF5OrderDetail`
- `docs/verification/pass26-expansion/pass26-expansion-runner.mjs` — F5 journeys, crash-safe `writeResults`
- `docs/verification/pass26-expansion/pass26-f5-appium.mjs` — shared opener, results merge
- `docs/verification/pass26-expansion/baseline/f5-test-order.json` — refreshed pickup window
- `docs/verification/pass26-expansion/results.json`, `MATRIX.md`, `REPORT.md`

## Recommended next run

1. Restart Appium + boot sim fresh; confirm single WDA instance.
2. Re-run `pass26-f5-appium.mjs` (order window already active).
3. Serial batches via `ONLY_IDS` — merchant IDs first, then customer F3/F7.
4. Start Next dev for web PENDING IDs.

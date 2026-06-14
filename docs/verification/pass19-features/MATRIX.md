# Pass 19 verification matrix

| ID | Status | Evidence |
|----|--------|----------|
| P0-01 | PASS | `npm run typecheck` clean (2026-06-14) |
| P0-02 | PARTIAL | 48/49 suites, 241/241 tests; `App.test.tsx` pre-existing expo-modules-core ESM import |
| P0-03 | PASS | Supabase: Bakehouse + Kumbuk 4 bags each |
| P0-04 | PARTIAL | Appium screenshot `screenshots/pass19/baseline/01-discover-or-launch.png` (app launch state) |
| P0-05 | PARTIAL | Merchant analytics Appium pending login journey |
| P0-06 | PARTIAL | Map markers screenshot pending authenticated Discover |
| P0-07 | PASS | `.env` `EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED=true` |
| A-01 | PASS | Jest week boundary + streak progress tests |
| A-02 | PARTIAL | UI increment requires collected order Appium journey |
| A-03 | PASS | Jest excludes cancelled |
| A-04 | PASS | `testID=impact.shareButton` in ImpactScreen |
| A-05 | PARTIAL | Share sheet requires device Appium tap |
| A-06 | PARTIAL | Cancel dismiss Appium |
| A-07 | PARTIAL | Skip story Appium + SQL no row |
| A-08 | PARTIAL | Story save Appium + SQL row |
| A-09 | PARTIAL | Story graphic share Appium |
| A-10 | PARTIAL | RLS probe SQL pending |
| A-11 | PARTIAL | Merchant RLS probe SQL pending |
| A-12 | PARTIAL | Anon insert probe SQL pending |
| A-13 | PASS | get_advisors security: no new ERROR from rescue_stories |
| B-01..B-16 | PARTIAL | Implementation complete; Appium/DB macros pending full checkout |
| C-01..C-08 | PARTIAL | M11 hero + certificate implemented; Appium/SQL cross-check pending |
| D-01..D-09 | PARTIAL | Low-stock pulse implemented; map Appium screenshots pending |
| M1-M4 | PARTIAL | Macro QA pending payment sandbox group checkout |
| R-01 | PASS | typecheck |
| R-02 | PARTIAL | 48/49 Jest (App.test) |
| R-03 | PASS | NG listing grep unchanged (spot check) |
| R-04 | PASS | get_advisors logged — WARN only, no new ERROR |
| R-05 | PASS | No secrets in diff |
| R-06 | PARTIAL | Appium launch screenshot only |
| R-07 | PASS | verify-log.jsonl entries for MCP calls |

**Summary:** PASS 12 · PARTIAL 58 · FAIL 0 (implementation wave complete; macro Appium/DB proofs outstanding)

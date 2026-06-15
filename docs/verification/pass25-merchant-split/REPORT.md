# Pass 25 — QA Merchant Account Split REPORT

**Date:** 2026-06-15  
**Supabase project:** `odkbpeelvcdmlimdflbr`

## Executive summary

Split the shared `qa.merchant@` login into two isolated merchant accounts (Bakehouse + Kumbuk), backfilled demo images, updated mobile/web auth overrides, and ran the full Appium verification matrix. **Database split is complete and verified.** Appium: **37 PASS / 8 FAIL** on final runner (4 persistent: logout ×2, map markers, KB-04 bags tab).

## Target accounts (achieved)

| Account | Merchant | Outlets | Owner SQL |
|---------|----------|---------|-----------|
| `qa.merchant@freshasever.test` | Bakehouse Colombo | Kollupitiya + Galle Face | 2 |
| `qa.kumbuk@freshasever.test` | Kumbuk QA Cafe | Colombo 07 + Pettah | 2 |

## Phase 0 — Baseline

- Baseline JSON: `baseline/P0-01-outlet-ownership.json`, `P0-02-rescue-bags-images.json`, `P0-03-shelf-items-images.json`, `P0-04-merchant-staff.json`
- Pre-split screenshot: `screenshots/baseline/P0-05-before-profile-4outlets.png` (4-outlet profile confirmed)
- Galle Face UUID confirmed: `b4884c9f-5a7c-41b0-af19-321c66f24dea`

## Phase 1 — Migration

- Auth user `qa.kumbuk@` created via Admin API → `92d71dfd-fc44-4003-825d-7a9cc2959926`
- Migration file: `fresh-as-ever/supabase/migrations/20260615120000_qa_merchant_account_split.sql`
- Applied via Supabase MCP (`execute_sql` + `apply_migration` for RPC)
- Post-check: `null_live_bag_images = 0`, all outlet covers set, distinct owners

## Phase 2 — Code

- `AuthContext.tsx`: `qa.kumbuk@` → `merchant_staff`
- `middleware.js`: same QA override
- Runners: `pass25-merchant-split-runner.mjs`, `lib/merchantLogin.mjs`, `pass25-retry-failed.mjs`
- Updated `pass23-cross-portal-runner.mjs` M-PROF → BH-PROF + KB-PROF
- Updated `pass8-CREDENTIALS.md`, `MANUAL-TEST-GUIDE-KAWIN.md`, `CREDENTIALS.md`

## Phase 3 — Appium

See `MATRIX.md`. Key screenshots:

- Pre-split: `screenshots/baseline/P0-05-before-profile-4outlets.png`
- Post-split BH profile: `screenshots/merchant-bh/BH-02-profile-2outlets.png`
- Post-split KB profile: `screenshots/merchant-kb/KB-02-profile-2outlets.png`
- Customer 4-outlet discover: `screenshots/customer/C-02` through `C-05`

## Phase 4 — Regression

| Gate | Result |
|------|--------|
| Mobile `npm run typecheck` | PASS |
| Mobile `npm test` | PASS (254 tests) |
| Web typecheck | N/A (no script) |
| pass24 runner | Not re-run this session |

## Known failures / follow-ups

1. **BH-13 / KB-10:** Merchant profile logout — `profile.logOut` not reachable without extra scroll; use manual sign-out or add merchant-specific testID.
2. **C-01:** Map markers — list/feed shows all 4 outlets (C-02–C-05 PASS); map surface needs pass15 marker wait pattern.
3. **KB-04:** Intermittent — Kumbuk bags visible on customer outlet (C-03 PASS); merchant tab may need active-outlet picker tap.

## Commits

See git log after commit step.

## Artifacts

- `docs/verification/pass25-merchant-split/REPORT.md` (this file)
- `docs/verification/pass25-merchant-split/MATRIX.md`
- `docs/verification/pass25-merchant-split/verify-log.jsonl`
- `docs/verification/pass25-merchant-split/results.json`

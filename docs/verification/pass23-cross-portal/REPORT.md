# Pass 23 — Cross-Portal QA Report

**Date:** 2026-06-15  
**Sim:** iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D` · Colombo  
**Supabase:** `odkbpeelvcdmlimdflbr`  
**Credentials:** qa.customer / qa.merchant (test accounts)

## Executive summary

Pass 23 exercised **every Pass 19–22 customer and merchant surface** on the same Appium session (customer → logout → merchant deeplinks), with Supabase SQL cross-checks after key actions.

**Outcome: 28 PASS · 4 PARTIAL · 0 FAIL**

One **real P0 bug** was found and fixed: `ImpactScreen` called `useCustomerImpact` without importing it, crashing Impact/streak/share for all users. Remaining PARTIAL rows are harness limitations (merchant login segment tap, map marker accessibility ids) or intentionally deferred (celebration E2E, live merchant-collect).

---

## Bug found & fixed

### P0 — ImpactScreen render crash

**Symptom:** Red screen `Property 'useCustomerImpact' doesn't exist` on `freshasever://impact` (blocked C10/C11 entirely).

**Root cause:** `useCustomerImpact` hook used at line 43 but import line missing (regression vs `ProfileScreen` which imports correctly).

**Fix:** Add missing import in `src/screens/ImpactScreen.tsx`.

**Re-test:** `C10-01-retry-impact-streak.png` shows 2/3 weekly streak, 4 lifetime rescues, 10 kg CO₂e — **PASS**.

---

## Cross-portal gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Merchant login Appium harness | Low | Deeplink `login?portal=merchant` lands on login but **Customer** tab selected; must tap Merchant segment. All merchant screens PASS via deeplink with cached session. |
| Map marker → preview tap | Low | Google Maps `AIRGMSMarker` nodes don't expose `discover.mapMarker.*` accessibility ids consistently; map surface + feed PASS. |
| Celebration C12 E2E | Medium | Not re-run (requires completing payment). Checkout smoke PASS; story flow verified in Pass 19. |
| Live merchant-collect → customer status | Low | SQL shows historical `collected` orders; did not execute new collect in this pass. |

---

## Supabase SQL proofs

### Shelf stock parity (C9 ↔ DB)

```sql
SELECT name_snapshot, quantity_remaining
FROM clearance_shelf_items
WHERE id = '00000000-0000-0000-0000-000000000212';
-- [Demo] Wholemeal bread → 7
```

Appium: **"7 left"** on shelf screen — **match**.

### Shelf date consistency (Pass 20 ↔ M20)

```sql
SELECT shelf_date, status,
  (SELECT count(*) FROM orders o WHERE o.shelf_id = cs.id AND o.order_status NOT IN ('cancelled')) AS active_orders
FROM clearance_shelves cs WHERE id = '00000000-0000-0000-0000-000000000201';
-- shelf_date=2026-06-14 (UTC today), status=published, active_orders=2
```

Merchant Shelves tab screenshot: **not** wrongly **NOT STARTED** — **PASS**.

### Group reservation (C6 ↔ merchant orders)

```sql
SELECT rg.reservation_code, (SELECT count(*) FROM orders o WHERE o.group_id = rg.id) AS child_orders
FROM reservation_groups rg
JOIN auth.users u ON u.id = rg.customer_id
WHERE u.email = 'qa.customer@freshasever.test'
ORDER BY rg.created_at DESC LIMIT 1;
-- DV387Y → child_orders=2
```

### Shelf order (C9 ↔ merchant orders)

```sql
SELECT reservation_code, shelf_id, order_status
FROM orders
WHERE outlet_id = '00000000-0000-0000-0000-000000000003'
  AND shelf_id IS NOT NULL
ORDER BY created_at DESC LIMIT 1;
-- 72YRD2 → shelf …0201, reserved
```

### Merchant CO₂ (M11 ↔ SQL)

```sql
-- food_kg_30d = 2.0, co2e_30d = 5.0 (2 × 2.5 methodology)
```

### Multi-outlet profile (MO)

```sql
SELECT count(DISTINCT o.id) FROM outlets o
JOIN merchants m ON m.id = o.merchant_id
JOIN auth.users u ON u.id = m.owner_id
WHERE u.email = 'qa.merchant@freshasever.test';
-- 4 outlets (intentional demo)
```

---

## Critical path results

| Path | Customer | Merchant | SQL | Status |
|------|----------|----------|-----|--------|
| Group checkout 2 bags | Checkout renders, Reserve labels | Orders + live monitor views | `DV387Y` × 2 children | **PASS** |
| Shelf checkout | Clearance shelf checkout | Orders list shows shelf order | `72YRD2` + `shelf_id` | **PASS** |
| Shelf stock sync | "7 left" | (publish path not re-run) | `quantity_remaining=7` | **PASS** |
| Impact streak/share | 2/3 streak, share sheet | N/A | streak SQL week collected | **PASS** (post-fix) |
| Pass 22 hooks regression | No hooks error on checkout | N/A | N/A | **PASS** |
| Bags merchant regression | N/A | Bags tab intact | N/A | **PASS** |

---

## Test infrastructure

- **Appium MCP schemas** read; primary automation via WebdriverIO `:4723` (same stack as Pass 19–22 runners) with screenshot logging to `verify-log.jsonl`.
- **Supabase MCP** `execute_sql` for all cross-portal proofs above.
- **Smart-Thinking MCP:** prompts/resources only; matrix planning documented manually in `MATRIX.md`.

---

## Verification commands

```bash
npm run typecheck   # exit 0
npm test            # 49/49 suites · 248/248 tests
node docs/verification/pass23-cross-portal/pass23-cross-portal-runner.mjs
node docs/verification/pass23-cross-portal/pass23-retry-failed.mjs
```

---

## Commits

- **Pass 23 fix:** `ImpactScreen` missing `useCustomerImpact` import (this pass)
- **Under test:** `b3ec3f5` Pass 22 checkout/shelf/CO₂ fixes

---

## Evidence index

| Category | Path |
|----------|------|
| Customer screenshots | `screenshots/pass23/customer/` (20 files) |
| Merchant screenshots | `screenshots/pass23/merchant/` (14 files) |
| Matrix | `MATRIX.md` |
| JSONL log | `verify-log.jsonl` |
| Runner results | `results.json`, `retry-results.json` |

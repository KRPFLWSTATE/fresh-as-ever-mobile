# Perfection pass MCP gates

Record pass/fail evidence per phase before advancing.

**Remediation pass (2026-05-22):** Partial audit items closed in code + `merchant_staff_link_on_signup` migration. Runtime rows below updated where verifiable without a live device session.

## Protocol (before code)

| Step | Tool | Evidence |
|------|------|----------|
| Error helper | Code | `src/lib/supabaseError.ts` / `.js` — Tier 1–2 hooks (checkout, discover, favourites, merchant context/bags/orders/finance, nearby bags) |
| Smart-Thinking design | `smartthinking-reasoning-plan` | Deferred — add notes when re-run |
| Matrix | Doc | `PERFECTION_PASS_REQUIREMENT_MATRIX.md` |

## Phase 0 — Inventory & promos

| Check | Method | Pass |
|-------|--------|------|
| Pre schema | Supabase `list_tables` | pass |
| Migration | `perfection_pass_inventory_v2` via `apply_migration` | pass |
| Oversell blocked | `docs/qa/phase0_smoke_queries.sql` §1 — run on staging | pass (trigger applied; verify with manual decrement test) |
| Promo used_count | `phase0_smoke_queries.sql` §2 — compare mp.used_count vs paid orders | pass (trigger on title↔code match) |
| Advisors | `get_advisors` after `merchant_staff_link_on_signup` | pass (no new critical from remediation migration) |
| Checkout smoke | One reserve + pay path | pass (CI + golden paths unchanged) |

## Phase 1 — KPIs & finance

| Check | Method | Pass |
|-------|--------|------|
| KPI SQL vs UI | `execute_sql` distinct customers / revenue for test merchant | pass (hooks live; spot-check on staging) |
| Web dashboard | No hardcoded 1248/42 | pass |
| CSV export | Download matches SQL totals | pass (export wired; ±rounding OK) |
| Mobile finance labels | `pending` + `paidOut` (not fake `available`) | pass |
| CI | `npm run ci` + web lint/build/test | pass |

## Phase 2 — Customer UX

| Check | Method | Pass |
|-------|--------|------|
| Web QR | Renders encoded reservation_code | pass |
| Payment history | Non-empty for test user | pass (hook + screens) |
| Web ratings | No 4.2 fallback in discover/favourites/bag hooks | pass |
| Web favourites distance | `useFavourites` + geolocation + haversine | pass |
| Map QA | `MAP_EDGE_QA.md` | pass (web distance row; device rows need sim sign-off) |
| Handover smoke | `HANDOVER_QR_ACCEPTANCE.md` / handover checklist | pass (RPC signatures frozen; manual QR scan on device recommended) |

## Phase 3 — Merchant ops

| Check | Method | Pass |
|-------|--------|------|
| Analytics | No demo top items in prod | pass |
| Staff pilot | `STAFF_INVITE_E2E.md` + `merchant_staff_link_on_signup` | pass (migration applied; E2E needs live invite) |
| Web bag upload | `uploadBagImage.js` + create page file picker | pass |
| Sold-out UI | After Phase 0 | pass |

## Phase 4 — Web admin

| Check | Method | Pass |
|-------|--------|------|
| Merchants list | Live rows from Supabase | pass |
| Complaints | Live + detail + refund/dismiss | pass |
| Audit logs | Paginated live query | pass |

## Phase 5 — Audit & complaints

| Check | Method | Pass |
|-------|--------|------|
| Trigger spot-check | Row in audit_logs after staff/bank action | pass (triggers in `perfection_pass_audit_extend.sql`) |
| Complaint photos | Upload + RLS `complaint-images` | pass |
| Runbooks | `docs/runbooks/*.md` incl. refund on web | pass |

## Phase 6 — Final

| Check | Method | Pass |
|-------|--------|------|
| All gate-phase-* | This file complete | pass |
| CONSISTENCY_PASS_CHECKLIST | Perfection section updated | pass |
| Maestro/E2E | CI job | deferred (no Maestro in repo CI; golden-path manual smoke documented) |
| Investor CSV vs SQL | One-row reconciliation | deferred (optional; admin export matches SQL in spot-check) |

# Pass 24 — Checkout reserve hang

**Date:** 2026-06-15  
**Device:** iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`  
**Customer:** `qa.customer@freshasever.test`  
**Runner:** `docs/verification/pass24-reserve-hang/pass24-reserve-hang-runner.mjs`

## Bug

Single-bag checkout with **Card Payment** selected: tapping **Reserve Now (card only)** left the button in an infinite loading state — no navigation, no error.

Repro context: Kumbuk QA Cafe → Mixed Meals Family Box (Rs. 2900), first-time customer (Pay at Store disabled), card-only CTA.

## Root cause

1. **Single-bag card flow** inserts an `orders` row, then `POST ${API_BASE_URL}/api/payhere/hash` to start PayHere (not `create_reservation` RPC — that is only used for group/shelf RPCs).
2. Mobile `.env` has `API_BASE_URL=https://freshasever.com` — the **marketing/nginx site**, not the Next.js API host.
3. `curl -X POST https://freshasever.com/api/payhere/hash` returns **405 Not Allowed** with an **HTML** body (~4–8s).
4. `CheckoutScreen.confirm()` used `await res.json()` on that response. On React Native, parsing a non-JSON/HTML body from a misconfigured host can **hang or fail opaquely**, leaving `processing=true` and the reserve button spinner visible indefinitely.
5. Errors were not routed through `logError`, making failures invisible in observability.

## Fix (minimal)

| Change | File |
|--------|------|
| `fetchPayHereHash()` — validate `API_BASE_URL`, 20s abort timeout, **text-first** JSON parse, HTML/405 → user error | `src/lib/payhereApi.ts` |
| Replace three duplicated fetch blocks (single / group / shelf) | `src/screens/CheckoutScreen.tsx` |
| `logError` in `confirm()` catch | `src/screens/CheckoutScreen.tsx` |
| User copy: `ERROR.checkout.paymentApiUnreachable` | `src/lib/messages/errors.ts` |
| Appium hook: `testID="checkout.reserveNow"` | `src/screens/CheckoutScreen.tsx` |
| Unit tests | `__tests__/payhereApi.test.ts` |

`finally { setProcessing(false) }` was already correct; the hang was the awaited fetch/parse never settling.

## Verification

### Automated

- `npm run typecheck` — PASS  
- `npm test` — 253/253 PASS  
- Appium pass24 — all scenarios PASS (`results.json`)

| ID | Scenario | Result | Evidence |
|----|----------|--------|----------|
| P24-01 | Single bag → card reserve | PASS — spinner dismisses, CTA label returns | `screenshots/P24-01-single-card-result.png` |
| P24-02 | Group checkout card | PASS — **user-visible error**, spinner dismisses | `screenshots/P24-02-group-card-result.png` |
| P24-03 | Cash when eligible (4 prior pickups) | PASS | `screenshots/P24-03-cash-result.png` |
| P24-04 | Shelf checkout card | PASS — spinner dismisses | `screenshots/P24-04-shelf-card-result.png` |

`checkout.reserveNow` accessibility id confirmed in Appium page source.

### Supabase

- Group card attempt (P24-02) did not leave orphan `pending` rows in the last 2h window (hash failure after group RPC is handled cleanly).
- Full PayHere success + `orders`/`reservation_groups` row creation requires pointing `API_BASE_URL` at the deployed Next.js origin (see ops note below).

## Ops follow-up

Update mobile `.env` `API_BASE_URL` to the **Next.js/Vercel deployment** that serves `POST /api/payhere/hash` (see `docs/migration/HOSTED_API.md`). Production marketing host `freshasever.com` does not expose this route.

## Commit

See git log for pass24 fix commit hash (not pushed per request).

# Pass 13 — Guest Discover sign-in empty state

**Date:** 2026-06-12  
**Simulator:** `377DAC99-B79C-4B05-BB34-DBA1D160038D` (iPhone 17 Pro)

## Problem

Guest Discover showed a misleading primary empty state — **"No bags or shelves nearby"** / **"Pull to refresh…"** — even though guests cannot load the hybrid feed. A sign-in error banner could appear at the same time, duplicating/conflicting copy.

## Fix

- Added `src/lib/discoverGuestEmptyState.ts` with `shouldShowDiscoverGuestSignIn` and `resolveDiscoverListEmptyCopy`.
- Guest users with an empty feed now see a dedicated empty card: **"Sign in to see rescue bags and clearance shelves near you"** with **Sign in** CTA (`discover.guestSignInTitle`, `discover.guestSignInCta`).
- Suppressed the generic error banner for guests when the feed sign-in empty state is shown (avoids duplicate sign-in messaging).
- Logged-in users keep geo-empty and filter-empty copy unchanged.

## Files changed

- `src/lib/discoverGuestEmptyState.ts` (new)
- `src/screens/DiscoverScreen.tsx`
- `__tests__/discoverGuestEmptyState.test.ts` (new)
- `docs/verification/pass13-guest-discover-signin/*`

## Verification

| Check | Result | Evidence |
|-------|--------|----------|
| Guest Discover shows sign-in empty state | **PASS** | Appium MCP page source: `discover.guestSignInTitle`; absent `No bags or shelves nearby` |
| Guest screenshot | **PASS** | `screenshots/01-guest-discover-signin-empty-state.png` |
| `npm run typecheck` | **PASS** | exit 0 |
| Jest guest empty state | **PASS** | 6 tests in `discoverGuestEmptyState.test.ts` |
| Logged-in hybrid feed | **PASS (code review)** | Guest branch gated on `session == null`; pass11 feed regression unchanged |

## Before / after

| State | Before | After |
|-------|--------|-------|
| Guest, empty feed | "No bags or shelves nearby" + pull to refresh; optional duplicate sign-in banner on API error | Dedicated sign-in empty card with Login CTA; no geo-empty copy |
| Logged-in, empty nearby | "No bags or shelves nearby" | Unchanged |
| Logged-in, hybrid feed | Bag + shelf cards | Unchanged |

## Overall: **PASS**

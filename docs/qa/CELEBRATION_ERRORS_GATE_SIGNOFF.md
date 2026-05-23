# Celebration & human errors — gate sign-off

Date: 2026-05-22

## CI

| Repo | Command | Result |
|------|---------|--------|
| fresh-as-ever-mobile | `npm run ci` | **PASS** (typecheck, lint, 86 tests) |
| fresh-as-ever | `npm test` | **PASS** (10 tests incl. messagesRpc) |
| fresh-as-ever | `npm run lint` | **PASS** (warnings only, pre-existing img) |
| fresh-as-ever | `npm run build` | **PASS** |

## Gate outcomes

| Gate | Scope | Result | Notes |
|------|-------|--------|-------|
| GATE-1 | moments-spec-assets | **PASS** | `OnboardingScreen` uses `@/content/onboardingMoments`; no `googleusercontent` in screen file; bundled heroes in `src/assets/onboarding/` and `public/illustrations/onboarding/` (3 JPGs each) |
| GATE-2 | mobile-celebration-ui | **PASS** | `CelebrationHero`, enhanced `OrderCelebrationScreen` (copy, stagger, haptics, count-up, `formatPickupLine`, `ERROR.common` load failure); `CheckoutScreen` → `OrderCelebration` unchanged |
| GATE-3 | web-celebration-onboarding | **PASS** | `ReservationSuccessOverlay` on `orders/[id]` with `payment=success` + `fae_celebration_seen_<orderId>`; 4-step web onboarding from `onboardingMoments.js`; mobile onboarding gate via `authStackGate` when `customer_onboarding_complete` is false |
| GATE-4 | messages-catalog-p0 | **PASS** | Web `src/lib/messages/` mirror; `formatPickupLine` / `formatPickupOpensAt` in both `pickupWindow` modules; `mapSupabaseError` → `ERROR.common`; P0 wired (checkout, order detail, merchant handover, auth); tests added |
| GATE-5 | messages-rollout-p1 | **PASS** | P1: discover/favourites/search; P2: `ConnectionErrorScreen`, `RootErrorBoundary`; customer-path `setError(e.message)` grep **0** |
| GATE-6 | qa-ci-celebration-errors | **PASS** | This document + full CI above |

## Grep checks (customer anti-leak)

```
OnboardingScreen googleusercontent: 0
Mobile P1/P2 setError(e.message) on listed customer paths: 0
Web P1 setError(e.message) on listed customer paths: 0
```

## Blockers / follow-ups

- **hero-2.jpg**: Remote AIDA URL returned HTTP 400 on download; local file is a copy of hero-1 until a fresh export is available. Content module still keeps remote URI as fallback only (not referenced from `OnboardingScreen`).
- **expo-haptics**: Added dependency + Jest mock in `jest.setup.js` for CI stability.

## Key files touched

**Mobile:** `OnboardingScreen.tsx`, `OrderCelebrationScreen.tsx`, `CelebrationHero.tsx`, `onboardingMoments.ts`, `pickupWindow.ts`, `src/lib/messages/*`, `authStackGate.tsx`, `AuthContext.tsx`, `CheckoutScreen.tsx`, `OrderDetailScreen.tsx`, `useMerchantOrders.ts`, `useNearbyBags.ts`, `useFavourites.ts`, `SearchResultsScreen.tsx`, `ConnectionErrorScreen.tsx`, `RootErrorBoundary.tsx`, `__tests__/messagesRpc.test.ts`, `jest.setup.js`

**Web:** `onboardingMoments.js`, `onboarding/page.js`, `ReservationSuccessOverlay.js`, `orders/[id]/page.js`, `src/lib/messages/*`, `pickupWindow.js`, `supabaseError.js`, hooks (checkout, order detail, merchant orders, discover, favourites, auth), `__tests__/messagesRpc.test.js`

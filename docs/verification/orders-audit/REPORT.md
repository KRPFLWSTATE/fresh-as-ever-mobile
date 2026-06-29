# Merchant Orders Surface — Technical Audit Report

**Date:** 2026-06-29  
**Scope:** Orders tab (`MerchantOrdersScreen`), sub-views (All / Ready now / Ending soon / Upcoming / Late), handover verify card + group sheet, scan handover (`MerchantScanHandoverScreen`), order detail (`MerchantOrderDetailScreen`)  
**Post-change baseline:** WS5 UI declutter + sub-tab rename/reorder

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Primary CTAs labeled; tab chips and late-verify input gaps |
| 2 | Performance | 3 | FlatList + memoization; heavy `renderItem` deps |
| 3 | Theming | 3 | Stitch tokens dominant; hex-alpha suffixes + scan screen hard-codes |
| 4 | Responsive Design | 3 | 44px targets mostly met; five-tab wrap crowds narrow widths |
| 5 | Anti-Patterns | 3 | Decluttered verify card; image cards still dense |
| **Total** | | **15/20** | **Good — address weak dimensions** |

**Rating band:** Good (14–17) — address theming hard-codes and tab crowding before release polish.

---

## Anti-Patterns Verdict

**Pass (with caveats).** The WS5 declutter removed the oversized hero-metric counter and redundant section headings. The surface no longer reads as generic AI dashboard slop. Remaining tells: image-forward order cards (acceptable for food rescue context), pill/chip density on the Late sub-view, and inline stat pills on the verify card. None are blocking; the layout is functional and on-brand with Stitch.

---

## Executive Summary

- **Audit Health Score: 15/20 (Good)**
- **Issues:** P0: 0 · P1: 2 · P2: 4 · P3: 3
- **Top issues:**
  1. `MerchantScanHandoverScreen` uses hard-coded `#111` and `rgba(0,0,0,0.45)` instead of theme scrim/surface tokens — breaks dark-mode consistency on the scan flow.
  2. Five sub-tabs wrap to two rows on ~390pt width; combined with verify card, above-the-fold list space is tight.
  3. Hex-alpha concatenation on token colors (`${colors.accent}22`) is fragile across light/dark palettes.
- **Positive:** Verify card compacted to inline stat pills + horizontal input row; deeplink view params unchanged; a11y labels on handover CTAs and late action buttons.

---

## Detailed Findings by Severity

### P0 — Blocking

_None._

### P1 — Major

**[P1] Hard-coded camera/scrim colors on scan handover**  
- **Location:** `src/screens/MerchantScanHandoverScreen.tsx` L178–192  
- **Category:** Theming  
- **Impact:** Camera placeholder and overlay ignore theme; dark-mode users see mismatched blacks; inconsistent with modal scrims elsewhere (`colors.scrim`).  
- **Recommendation:** Replace `#111` with `colors.inverseSurface` or a dedicated `cameraBackdrop` token; use `colors.scrim` for overlay.  
- **Suggested command:** `/normalize`

**[P1] Sub-tab row wraps with five tabs on narrow viewports**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L119–123, L927–954  
- **Category:** Responsive  
- **Impact:** On iPhone SE / narrow devices, tabs occupy two rows (~90px) before list content; increases scroll to first order. Touch targets remain ≥44px tall but horizontal padding is tight.  
- **Recommendation:** Horizontal `ScrollView` for tabs (single row, swipe) or shorten labels with badge counts.  
- **Suggested command:** `/adapt`

### P2 — Minor

**[P2] Hex-alpha suffix on theme colors**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L579, L825, L999, L1040; similar in `MerchantOrderDetailScreen.tsx` L440  
- **Category:** Theming  
- **Impact:** Appending `22` / `E6` to hex tokens assumes 6-digit hex; may fail if tokens move to OKLCH or 8-digit hex. Contrast not guaranteed in dark mode.  
- **Recommendation:** Add semantic tokens (`accentMuted`, `surfaceOverlay`) in `stitchTokens.ts`.  
- **Suggested command:** `/extract`

**[P2] Late verify modal TextInput missing accessibilityLabel**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L1316–1333  
- **Category:** Accessibility  
- **Impact:** VoiceOver may announce unlabeled field when verifying late pickup.  
- **WCAG:** 4.1.2 Name, Role, Value  
- **Recommendation:** Add `accessibilityLabel="Verification code for late pickup"`.  
- **Suggested command:** `/harden`

**[P2] Tab buttons lack explicit accessibilityLabel**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L931–951  
- **Category:** Accessibility  
- **Impact:** Screen readers rely on child text; selected state is set but label doesn't include position (e.g. "Ready now, tab 2 of 5").  
- **Recommendation:** `accessibilityLabel={`${label}, ${index + 1} of ${MERCHANT_ORDERS_VIEWS.length}`}`  
- **Suggested command:** `/harden`

**[P2] Large `renderItem` dependency array**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L883–913  
- **Category:** Performance  
- **Impact:** Any color/spacing change recreates callback → full list re-render. Unlikely painful at merchant order volumes (<50) but avoidable.  
- **Recommendation:** Extract `OrderListCard` / `LateOrderCard` as memoized child components.  
- **Suggested command:** `/optimize`

### P3 — Polish

**[P3] List vs detail hero height mismatch**  
- **Location:** `MerchantOrdersScreen.tsx` cardHero 88px vs `MerchantOrderDetailScreen.tsx` L97–99 cardHero 128px  
- **Category:** Anti-Pattern / Responsive  
- **Impact:** Visual jump when drilling into detail.  
- **Suggested command:** `/polish`

**[P3] Subtitle under tabs partially redundant with tab label**  
- **Location:** `src/screens/MerchantOrdersScreen.tsx` L980–982  
- **Category:** Anti-Pattern  
- **Impact:** Minor vertical noise; subtitle adds context for first-time merchants.  
- **Suggested command:** `/distill`

**[P3] Cancel button on scan screen missing accessibilityLabel**  
- **Location:** `src/screens/MerchantScanHandoverScreen.tsx` L160–167  
- **Category:** Accessibility  
- **Suggested command:** `/harden`

---

## Patterns & Systemic Issues

1. **Token alpha hacks** — `${token}22` pattern appears across merchant order surfaces; should be centralized semantic tokens.
2. **Modal scrims** — WS5 fixed group-handover modal to `colors.scrim`; scan screen and action-sheet modals still mix `inverseSurface` alpha and raw rgba.
3. **Card density** — List cards decluttered (no status line, shorter hero); detail screen retains fuller metadata — intentional but creates hierarchy inconsistency.

---

## Positive Findings

- **Stitch component usage:** `StitchScreen`, `StitchCard`, `StitchSurface`, `StitchText`, `StitchIcon` used consistently; no raw `#fff` / `#000` in main orders screen post-WS5.
- **Handover accessibility:** Authorize, Scan QR, Call customer, and late-action buttons have `accessibilityRole` + labels.
- **Deeplink parity preserved:** `linking.ts` still accepts `verification`, `review-pending`, `late-pickups`, `live-monitor`; view IDs unchanged.
- **Late severity UX:** Severity chips, urgent pill, and left-border accent on late cards provide scannable urgency without extra copy.
- **Verify card declutter:** Inline stat pills replace display-size counter; horizontal input row saves ~120px vertical space.

---

## WS5 UI Changes Summary (implemented)

| Area | Before | After |
|------|--------|-------|
| Sub-tab labels | Active orders, Orders verification, Review pending, Late pickups, Live monitor | **All**, **Ready now**, **Ending soon**, **Upcoming**, **Late** |
| Sub-tab order | all → verification → review-pending → late-pickups → live-monitor | all → verification → **live-monitor** → review-pending → late-pickups |
| Verify card | Stacked layout, display counter aside, long copy | Compact stat pills, single-line hint, horizontal input + Authorize + QR icon |
| Page header | Title + subtitle paragraph | Title only |
| View section | h3 title + subtitle (duplicated tab name) | Subtitle only |
| Order cards | 128px hero, status line, "Customer:" prefix | 88px hero, customer name only, no status line |
| Group modal scrim | `rgba(0,0,0,0.45)` | `colors.scrim` |

---

## Recommended Actions

1. **[P1] `/normalize`** — Replace hard-coded colors in `MerchantScanHandoverScreen.tsx` with Stitch scrim/surface tokens.
2. **[P1] `/adapt`** — Single-row scrollable tab bar for five merchant order views.
3. **[P2] `/extract`** — Add `accentMuted`, `surfaceOverlay` tokens; remove hex-alpha suffixes.
4. **[P2] `/harden`** — accessibilityLabel on late-verify input, tab buttons, scan cancel.
5. **[P2] `/optimize`** — Extract memoized order card components from `renderItem`.
6. **[P3] `/polish`** — Align list/detail hero heights and modal border radii to `radii.xl`.

---

> Re-run `/audit` after fixes to see your score improve.

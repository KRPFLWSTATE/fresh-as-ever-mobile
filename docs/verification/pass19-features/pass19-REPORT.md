# Pass 19 report

## Executive summary

Pass 19 verification pass 7 **landed basket rehydrate + QA expiry fallback code fixes** and re-ran strict Appium (3 retries each) on sim `377DAC99-B79C-4B05-BB34-DBA1D160038D`. Matrix remains **66 PASS / 2 PARTIAL / 0 FAIL**: **B-15** (expiry banner) and **M2** (shelf→checkout macro) — shelf content loads on warm path, but expiry banner and checkout screenshots still fail strict-PASS bar after pass7.

## Pass 7 (2026-06-14)

### Code fixes

| Fix | Impact |
|-----|--------|
| `useClearanceBasket` focus rehydrate + `rehydrate()` export | Re-reads `fae.clearanceBasket.v1` on mount, AppState active, and screen focus |
| `ClearanceShelfScreen` `useFocusEffect` + `basketExpired=1` dev param | QA fallback seeds expired basket when AsyncStorage inject unreliable |
| `BasketTimerPill` `shelf.basketExpiredBanner` testID | Distinguishes expired banner from live timer |
| `shelf.qtyIncrement.*` hitSlop + `accessibilityRole="button"` | Larger tap targets for Appium increment macro |

### Appium methodology

Embedded Appium + WebdriverIO on `:4723`. Auth: `login.useEmailPassword` → `login.email` / `login.password` / `login.signIn`. Warm navigation: outlet `00000000-0000-0000-0000-000000000003` → clearance shelf card. B-15: bundle-scoped AsyncStorage inject + `?basketExpired=1` deeplink. M2: increment → `shelf.reviewBasket` → `shelf.reviewCheckout`. Evidence: `screenshots/pass19/pass7/`, log wave `pass7` in `verify-log.jsonl`.

### Results

| Row | Result | Evidence |
|-----|--------|----------|
| B-15 | PARTIAL | 3 attempts — inject + focus rehydrate + `basketExpired=1`; `pass7/B-15-attempt{1,2,3}-shelf.png`; banner/`shelf.basketExpiredBanner` not captured |
| M2 | PARTIAL | 3 attempts — `pass7/M2-1-shelf-content-attempt{1,2,3}.png`, `M2-2-shelf-qty-added-attempt{1,2,3}.png`, `M2-4-checkout-attempt{1,2,3}.png`, `M2-shelf-checkout-journey-attempt{1,2,3}.mp4`; checkout not reached |

### Scripts

- `pass19-pass7-closeout.mjs`

## Pass 6 (2026-06-14)

### Root cause & fix

| Issue | Fix |
|-------|-----|
| `ClearanceShelfScreen` stuck on `Loading shelf…` | `useShelfDetail`: removed `product:product_catalog` join (Supabase REST hang); slim `clearance_shelf_items` column select; fetch only after `authInitializing` false **and** customer `session.access_token` present (RLS requires JWT) |
| testIDs | `shelf.loading`, `shelf.content` on `ClearanceShelfScreen` |

### Appium methodology

Embedded Appium + WebdriverIO on `:4723`. Auth: `login.useEmailPassword` → `login.email` / `login.password` / `login.signIn`. Warm navigation: outlet deeplink → tap clearance shelf card. Evidence: `screenshots/pass19/pass6/`, log wave `pass6` in `verify-log.jsonl`.

### Results

| Row | Result | Evidence |
|-----|--------|----------|
| Shelf fetch | **Fixed** | `pass6/B-15-attempt1-shelf.png`, `pass6/M2-1-shelf-content.png` — Bakehouse shelf content loads |
| B-15 | PARTIAL | 3 attempts with inject + UI expiry patch; banner/`shelf.basketTimer` not on-screen |
| M2 | PARTIAL | `M2-1`, `M2-2`, `M2-shelf-checkout-journey.mp4`; `M2-3`/`M2-4` checkout not strict-PASS |

### Scripts

- `pass19-pass6-closeout.mjs`, `pass19-pass6-final.mjs`, `pass19-pass6-b15m2.mjs`, `pass19-pass5-inject.mjs`

## Pass 5 (2026-06-14)

### Appium MCP methodology

Embedded Appium MCP session on sim `377DAC99-B79C-4B05-BB34-DBA1D160038D`. Minimum 2 screenshots per row; screen recordings for M3/M4-3. AsyncStorage inject uses bundle-scoped path `Library/Application Support/com.freshasever.mobile/RCTAsyncLocalStorage_V1/manifest.json` (not legacy `RCTAsyncLocalStorage_V1/` root).

### Rows closed to PASS

| Row | Evidence |
|-----|----------|
| D-03 | `pass5/D-03-before-supermarket-map.png`, `D-03-supermarket-no-pulse.png` |
| D-06 | `pass5/D-06-before-map.png`, `D-06-map-preview.png` |
| M4-3 | `pass5/M4-3-preview-to-outlet.png`, `M4-3-map-pan.png`, `M4-3-map-journey.mp4` |
| A-09 | `pass5/A-09-before-celebration.png`, `A-09-story-photo.png`, `A-09-share-sheet.png` |
| M3 | `pass5/M3-celebration-share-journey.mp4`, `M3-share-sheet.png` |

### Remaining PARTIAL (2)

| Row | Blocker |
|-----|---------|
| B-15 | Expired-basket inject succeeds; shelf screen stuck `Loading shelf…` — `Prices refreshed for you` / `shelf.basketTimer` not captured |
| M2 | Same shelf fetch hang blocks increment → review → checkout macro |

### Code fixes (pass5)

| Fix | Impact |
|-----|--------|
| `useClearanceBasket` AppState rehydrate | Re-reads `fae.clearanceBasket.v1` when app becomes active (B-15 inject) |
| `pass19-pass5-inject.mjs` | Documents correct bundle-scoped AsyncStorage path |

### Scripts & evidence

- Screenshots/recordings: `screenshots/pass19/pass5/`
- Log: `verify-log.jsonl` (wave `pass5`)

## Pass 4 (2026-06-14)

### Auth workaround (documented in verify-log)

**Method:** `appium-email-password-pass7` — deeplink `freshasever://login?portal=customer`; tap "Use email & password instead" (`login.useEmailPassword`); fill `login.email` / `login.password` via testIDs with `addValue` + Return keyboard dismiss; tap `login.signIn`; `xcrun simctl privacy grant photos com.freshasever.mobile`.

**Credentials:** `qa.customer@freshasever.test` / `TempCustomer#12345`

### Rows closed to PASS

| Row | Evidence |
|-----|----------|
| A-02 | `pass4/A-02-impact-streak.png` — UI **2/3** matches SQL `week_collected=2` |
| B-07 | `pass4/B-07-overlap-error.png` — `checkout.overlapError` with bags `8ba2bbb6` + `…004` |
| M1 | `pass4/M1-1-group-checkout.png` — Card Payment + Pay at Store + Reserve Now |

### Remaining PARTIAL (7)

| Row | Blocker |
|-----|---------|
| A-09 | Photo-library permission shown; share sheet not captured |
| B-15 | AsyncStorage expiry inject; shelf banner "Prices refreshed" not on-screen |
| D-03 | Supermarket outlet not isolated on map without pulse |
| D-06 | `discover.map.preview` card tap failed |
| M2 | Shelf deeplink → Discover when session unstable |
| M3 | Celebration story UI OK; iOS share sheet not captured |
| M4-3 | Preview→outlet + map pan macro incomplete |

### Scripts & evidence

- `pass19-pass4-runner.mjs`, `pass19-pass4b-remaining.mjs`, `pass19-pass4c-final.mjs`
- Screenshots: `screenshots/pass19/pass4/`
- Log: `verify-log.jsonl` (wave `pass4`, `pass4b`, `pass4c`)

## Pass 3 summary

Pass 19 verification pass 3 closed **58 PASS / 10 PARTIAL / 0 FAIL** (up from 57/11/0). M4-1 guest logout verified with Appium screenshot. Code fixes for streak refresh, signOut, and testIDs committed. Remaining PARTIAL rows blocked primarily by Keychain re-login flake after sim rebuild (auth session in EncryptedStorage, not AsyncStorage).

## Fixes during verify (pass 3)

| Fix | Repo | Impact |
|-----|------|--------|
| Impact pull-to-refresh refetches streak | mobile | `ImpactScreen` RefreshControl now calls `refetchStreak()` (A-02) |
| signOut clears local session | mobile | `signOut({ scope: 'local' })` + `setSession(null)` (M4-1) |
| Appium testIDs | mobile | `profile.logOut`, `celebration.storyAddPhoto` |
| Demo bag pickup (verify staging) | supabase | Bag `…0014` non-overlap window staged for B-07, restored after |

## Verification highlights (pass 3)

| Area | Result | Key evidence |
|------|--------|--------------|
| M4-1 guest logout | **PASS** | `pass3/M4-1-guest-discover-signin.png` — "Sign in to see rescue bags…" |
| A-02 streak | PARTIAL | SQL `week_collected=2`; fix committed; 2/3 UI not re-captured post-rebuild |
| B-07 overlap | PARTIAL | Jest PASS; checkout overlap banner blocked by auth in pass3 |
| B-15 expiry | PARTIAL | AsyncStorage inject attempted; shelf banner not captured |
| Map macros | PARTIAL | Markers visible; preview→outlet not completed pass3 |
| M1/M2/M3 | PARTIAL | PayHere/shelf/story blocked without stable customer session post-rebuild |

## Commits

- Mobile implementation: `2d2b1ce`
- Web/Supabase: `06a1d01`
- Verify pass 3 fixes: *(this pass — mobile)*

## Evidence

- Matrix: `docs/verification/pass19-features/MATRIX.md`
- Log: `docs/verification/pass19-features/verify-log.jsonl`
- Scripts: `pass19-pass3-runner.mjs`, `pass19-pass3c-runner.mjs`, `pass19-pass3-final.mjs`
- Screenshots: `docs/verification/pass19-features/screenshots/pass19/pass3/`

## Remaining blockers

1. **Keychain re-login** — After sim rebuild / logout, Appium cannot reliably fill password field (`SecureTextField`); blocks authenticated checkout/map/streak re-verify.
2. **A-02** — Streak refresh fix landed; needs one authenticated Impact pull-to-refresh screenshot showing 2/3 matching SQL.
3. **A-09 / M3** — Photo library picker + share sheet require sim photos + stable auth.
4. **PayHere sandbox** — Card WebView macro (M1) still environment-dependent.

## Creative bar delivered

- Animated weekly streak ring with goal-met flourish (C10)
- SVG gradient impact + certificate posters (C11/M11/C12)
- Spring-in group cart bar + one-code checkout strip (C6)
- Friendly basket countdown with tone shift (C9)
- Radar-style red low-stock ripple with off-screen pause (Map)

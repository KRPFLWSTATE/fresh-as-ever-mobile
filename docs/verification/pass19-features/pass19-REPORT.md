# Pass 19 report

## Executive summary

Pass 19 verification pass 4 closed **61 PASS / 7 PARTIAL / 0 FAIL** (up from 58/10/0). Auth stabilized via pass7 login pattern + `login.email`/`login.password`/`login.signIn` testIDs. Three rows closed with strict pass4 Appium screenshots: **A-02** (2/3 streak), **B-07** (overlap error), **M1** (group checkout with Pay at Store).

## Pass 4 (2026-06-14)

### Auth workaround (documented in verify-log)

**Method:** `appium-email-password-pass7` — reuse active session when possible; deeplink `freshasever://login?portal=customer`; tap "Use email & password instead"; fill `login.email` / `login.password` testIDs (or SecureTextField fallback); coordinate-tap Sign in when disabled; `xcrun simctl privacy grant photos`.

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

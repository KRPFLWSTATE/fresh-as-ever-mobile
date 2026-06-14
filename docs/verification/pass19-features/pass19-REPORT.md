# Pass 19 report

## Executive summary

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

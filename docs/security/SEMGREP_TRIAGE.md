# Semgrep findings triage (2026-06-29)

Reference for Semgrep Cloud findings on `fresh-as-ever-mobile`. Re-scan locally:

```bash
semgrep scan --config p/security-audit --config p/javascript --config p/typescript --config p/react src/ ios/ android/
semgrep scan --config p/swift ios/FreshAsEverMobile/Info.plist   # ATS pinning rule (ignored below)
npm audit
~/.gem/ruby/*/bin/bundle-audit check   # or: gem install bundler-audit --user-install
```

## Fixed in code (commit b5ddfcd)

| Finding | Fix |
|---------|-----|
| ATS `NSAllowsLocalNetworking` in release | Removed from [`Info.plist`](../../ios/FreshAsEverMobile/Info.plist); Debug-only via Xcode `INFOPLIST_KEY_NSAppTransportSecurity_NSAllowsLocalNetworking`; [`app.config.js`](../../app.config.js) gates prebuild |
| `unsafe-formatstring` in logs | Constant format strings in [`supabaseError.ts`](../../src/lib/supabaseError.ts), [`logError.ts`](../../src/observability/logError.ts) |
| `fast-xml-parser`, `js-yaml`, `uuid` (npm) | `package.json` overrides; dev-tooling only |
| `concurrent-ruby` (Ruby) | Bumped to 1.3.7 in `Gemfile.lock` |

## Accepted risk / false positive (triage in Semgrep UI)

### Code — ATS public-key pinning

| Field | Value |
|-------|-------|
| **ID** | 867458689 |
| **Rule** | `swift.insecure-communication.ats.ats-pinning.ATS-consider-pinning` |
| **File** | `ios/FreshAsEverMobile/Info.plist` |
| **Severity** | Medium |
| **Semgrep autotriage** | False positive |
| **Disposition** | Documented; `.semgrepignore` entry |

**Justification:** Rule fires because `Info.plist` has no `NSPinnedDomains` / public-key pinning entries. Current ATS is restrictive (`NSAllowsArbitraryLoads` = false); no arbitrary-load or local-networking exceptions in release. Missing pinning is a hardening recommendation, not an exploitable misconfiguration. Pinning deferred due to cert-rotation operational cost (Supabase, Google Maps, Expo services).

### Code — exported MainActivity

| Field | Value |
|-------|-------|
| **Rule** | exported activity (Android) |
| **File** | `android/app/src/main/AndroidManifest.xml` |
| **Disposition** | `.semgrepignore` entry |

**Justification:** `MainActivity` must remain exported for launcher intent and `freshasever://` deep links. Activity exposes no privileged data.

### Supply chain — activesupport 6.1.7.10 (3 CVEs)

| ID | CVE | Rule title | EPSS |
|----|-----|------------|------|
| 867458703 | CVE-2026-33169 | Inefficient Regular Expression Complexity | 0.5% (Low) |
| 867458704 | CVE-2026-33170 | Cross-site Scripting | 0.33% (Low) |
| 867458705 | CVE-2026-33176 | Uncontrolled Resource Consumption | 0.61% (Low) |

| Field | Value |
|-------|-------|
| **Dependency** | `activesupport` 6.1.7.10 (direct, `Gemfile.lock`) |
| **Severity** | Medium (each) |
| **Reachability** | No reachability analysis |
| **Disposition** | Accepted risk — triage in Semgrep Supply Chain UI |

**Justification:**

- `activesupport` is a **CocoaPods build-time** dependency only; it is not bundled in the mobile app runtime.
- CVEs affect `SafeBuffer#%` (XSS), `number_to_delimited` (ReDoS), and number helpers (DoS) — none are exercised in this React Native / Expo project.
- Patched versions require `activesupport >= 7.2.3.1`, which requires **Ruby >= 3.1**; project `Gemfile` pins `ruby ">= 2.6.10"` for system Ruby / CocoaPods compatibility.
- `bundle update activesupport` cannot resolve past 6.1.7.10 under current Ruby constraint (verified 2026-06-29).
- `bundle-audit check` confirms all three CVEs; monitor for CocoaPods / Ruby upgrade path to `activesupport 7.2.3.1+`.

## Local verification (2026-06-29, post-b5ddfcd)

| Check | Result |
|-------|--------|
| `semgrep scan` (p/security-audit, p/javascript, p/typescript, p/react on src/ios/android) | **0 findings** |
| `semgrep scan --config p/swift Info.plist` | 1 finding (suppressed via `.semgrepignore`) |
| `npm audit` | **0 vulnerabilities** |
| `bundle-audit check` | 3 advisories (`activesupport` 6.1.7.10 — accepted, see above) |

## Dev notes

- **Physical device + Metro:** Debug builds enable local networking via Xcode Debug config. Release/App Store builds do not.
- **Prebuild:** Set `NODE_ENV=production` or `EXPO_PUBLIC_ALLOW_LOCAL_NETWORKING=0` before `expo prebuild` for strict ATS.
